import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  cacheDirectory,
  documentDirectory,
  deleteAsync,
  writeAsStringAsync,
  readAsStringAsync,
  getInfoAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import Share from 'react-native-share';
// import RNQRGenerator from 'rn-qr-generator';
import presentAlert from '../components/Alert';
import loc from '../loc';
import { isDesktop } from './environment';
import { readFile } from './react-native-bw-file-access';

const _sanitizeFileName = (fileName: string) => {
  // Remove any path delimiters and non-alphanumeric characters except for -, _, and .
  return fileName.replace(/[^a-zA-Z0-9\-_.]/g, '');
};

export const isCancel = (err: any): boolean => {
  return err.code === 'OPERATION_CANCELED' || err.message === 'OPERATION_CANCELED';
};

const _shareOpen = async (filePath: string, showShareDialog: boolean = false) => {
  try {
    await Share.open({
      url: 'file://' + filePath,
      saveToFiles: isDesktop || !showShareDialog,
      // @ts-ignore: Website claims this propertie exists, but TS cant find it. Send anyways.
      useInternalStorage: Platform.OS === 'android',
      failOnCancel: false,
    });
  } catch (error: any) {
    console.log(error);
    // If user cancels sharing, we dont want to show an error. for some reason we get 'CANCELLED' string as error
    if (error.message !== 'CANCELLED') {
      presentAlert({ message: error.message });
    }
  } finally {
    try {
      await deleteAsync(filePath, { idempotent: true });
    } catch (e) {}
  }
};

/**
 * Writes a file to fs, and triggers an OS sharing dialog, so user can decide where to put this file (share to cloud
 * or perhaps messaging app). Provided filename should be just a file name, NOT a path
 */

export const writeFileAndExport = async function (fileName: string, contents: string, showShareDialog: boolean = true) {
  const sanitizedFileName = _sanitizeFileName(fileName);
  try {
    if (Platform.OS === 'ios') {
      const filePath = `${cacheDirectory}${sanitizedFileName}`;
      await writeAsStringAsync(filePath, contents);
      await _shareOpen(filePath, showShareDialog);
    } else if (Platform.OS === 'android') {
      const filePath = `${documentDirectory}${sanitizedFileName}`;
      try {
        await writeAsStringAsync(filePath, contents);
        if (showShareDialog) {
          await _shareOpen(filePath);
        } else {
          presentAlert({ message: loc.formatString(loc.send.file_saved_at_path, { filePath }) });
        }
      } catch (e: any) {
        console.error(e);
        presentAlert({ message: e.message });
      }
    }
  } catch (error: any) {
    console.error(error);
    presentAlert({ message: error.message });
  }
};

/**
 * Opens & reads *.psbt files, and returns base64 psbt. FALSE if something went wrong (wont throw).
 */
export const openSignedTransaction = async function (): Promise<string | false> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'ios' ? ['application/json', '*/*'] : '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      throw { code: 'OPERATION_CANCELED' };
    }

    return await _readPsbtFileIntoBase64(result.assets[0].uri);
  } catch (err: any) {
    if (!isCancel(err)) {
      presentAlert({ message: loc.send.details_no_signed_tx });
    }
  }

  return false;
};

const _readPsbtFileIntoBase64 = async function (uri: string): Promise<string> {
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  const stringData = Buffer.from(base64, 'base64').toString(); // decode from base64
  if (stringData.startsWith('psbt')) {
    // file was binary, but outer code expects base64 psbt, so we return base64 we got from rn-fs;
    // most likely produced by Electrum-desktop
    return base64;
  } else {
    // file was a text file, having base64 psbt in there. so we basically have double base64encoded string
    // thats why we are returning string that was decoded once;
    // most likely produced by ColdCard
    return stringData;
  }
};

export const showImagePickerAndReadImage = async (): Promise<string | undefined> => {
  try {
    const response = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
    });

    if (response.canceled) {
      return undefined;
    } else if (response.assets && response.assets.length > 0) {
      try {
        const uri = response.assets[0].uri;
        if (uri) {
          // Temporarily disabled due to missing rn-qr-generator dependency
          // const result = await RNQRGenerator.detect({ uri: decodeURI(uri) });
          // if (result?.values && result.values.length > 0) {
          //   return result.values[0];
          // }
        }
        throw new Error(loc.send.qr_error_no_qrcode);
      } catch (error) {
        console.error(error);
        presentAlert({ message: loc.send.qr_error_no_qrcode });
      }
      throw new Error(loc.send.qr_error_no_qrcode);
    }

    return undefined;
  } catch (error: any) {
    console.error(error);
    throw error;
  }
};

export const showFilePickerAndReadFile = async function (): Promise<{ data: string | false; uri: string | false }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      throw { code: 'OPERATION_CANCELED' };
    }

    const pickedFile = result.assets[0];
    const fileCopyUri = pickedFile.uri;
    const lowerName = (pickedFile.name || fileCopyUri).toLowerCase();

    if (lowerName.endsWith('.psbt')) {
      // this is either binary file from ElectrumDesktop OR string file with base64 string in there
      const file = await _readPsbtFileIntoBase64(fileCopyUri);
      return { data: file, uri: fileCopyUri };
    }

    if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      return await handleImageFile(fileCopyUri);
    }

    const file = await readAsStringAsync(fileCopyUri, { encoding: EncodingType.UTF8 });
    return { data: file, uri: fileCopyUri };
  } catch (err: any) {
    if (!isCancel(err)) {
      presentAlert({ message: err.message });
    }
    return { data: false, uri: false };
  }
};

const readFileAsBase64 = async (uri: string): Promise<string> => {
  try {
    const info = await getInfoAsync(uri);
    if (!info.exists) {
      throw new Error('File does not exist');
    }
    // Temporarily disabled due to missing rn-qr-generator dependency
    // First attempt: use original URI
    // const result = await RNQRGenerator.detect({ uri: decodeURI(uri) });
    // if (result?.values && result.values.length > 0) {
    //   return result.values[0];
    // }
    // Second attempt: remove file:// prefix and try again
    // const altUri = uri.replace(/^file:\/\//, '');
    // const result2 = await RNQRGenerator.detect({ uri: decodeURI(altUri) });
    // if (result2?.values && result2.values.length > 0) {
    //   return result2.values[0];
    // }
    throw new Error(loc.send.qr_error_no_qrcode);
  } catch (error: any) {
    console.error(error);
    throw error;
  }
};

const handleImageFile = async (fileCopyUri: string): Promise<{ data: string | false; uri: string | false }> => {
  try {
    const qrData = await readFileAsBase64(fileCopyUri);
    if (qrData) {
      return { data: qrData, uri: fileCopyUri };
    }
    throw new Error(loc.send.qr_error_no_qrcode);
  } catch {
    throw new Error(loc.send.qr_error_no_qrcode);
  }
};

export const readFileOutsideSandbox = (filePath: string) => {
  if (Platform.OS === 'ios') {
    return readFile(filePath);
  } else if (Platform.OS === 'android') {
    return readAsStringAsync(filePath, { encoding: EncodingType.UTF8 });
  } else {
    presentAlert({ message: 'Not implemented for this platform' });
    throw new Error('Not implemented for this platform');
  }
};

export const openSignedTransactionRaw: () => Promise<string> = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      throw { code: 'OPERATION_CANCELED' };
    }

    const file = await readAsStringAsync(result.assets[0].uri, { encoding: EncodingType.UTF8 });
    if (file) {
      return file;
    } else {
      throw new Error('Could not read file');
    }
  } catch (err: any) {
    if (!isCancel(err)) {
      presentAlert({ message: loc.send.details_no_signed_tx });
    }

    return '';
  }
};

export const pickTransaction = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  return result.assets[0];
};
