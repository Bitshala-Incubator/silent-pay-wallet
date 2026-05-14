//
//  UserDefaultsGroupKeys.swift
//  Shroud
//
//  Created by Marcos Rodriguez on 4/14/24.
//  Copyright © 2026 Shroud contributors. All rights reserved.
//

import Foundation

enum UserDefaultsGroupKey: String {
  case GroupName = "group.org.bitshala.shroud"
  case PreferredCurrency = "preferredCurrency"
  case WatchAppBundleIdentifier = "org.bitshala.shroud.watch"
  case BundleIdentifier = "org.bitshala.shroud"
  case ElectrumSettingsHost = "electrum_host"
  case ElectrumSettingsTCPPort = "electrum_tcp_port"
  case ElectrumSettingsSSLPort = "electrum_ssl_port"
  case AllWalletsBalance = "WidgetCommunicationAllWalletsSatoshiBalance"
  case AllWalletsLatestTransactionTime = "WidgetCommunicationAllWalletsLatestTransactionTime"
  case LatestTransactionIsUnconfirmed = "\"WidgetCommunicationLatestTransactionIsUnconfirmed\""
}
