import React from 'react';
import { ScrollView } from 'react-native';

import { ShroudCard, ShroudText } from '../../components/ShroudComponents';

const ReleaseNotes: React.FC = () => {
  const notes = require('../../../release-notes');

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" automaticallyAdjustContentInsets>
      <ShroudCard>
        <ShroudText>{notes}</ShroudText>
      </ShroudCard>
    </ScrollView>
  );
};

export default ReleaseNotes;
