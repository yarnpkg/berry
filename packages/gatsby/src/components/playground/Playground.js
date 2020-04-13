import styled                           from '@emotion/styled';
import React, {useState}                from 'react';

// TODO: create `playgroundUtils.runInput` function
// import * as playgroundUtils             from '../../utils/playgroundUtils';

import PlaygroundInput                  from './PlaygroundInput';

import PlaygroundOutput                 from './PlaygroundOutput';
import PlaygroundResults                from './PlaygroundResults';
import PlaygroundRunButton              from './PlaygroundRunButton';
import PlaygroundSelect                 from './PlaygroundSelect';
import PlaygroundStatus                 from './PlaygroundStatus';

import {SELECT_OPTIONS, STATUS, LABELS} from './constants';

const Container = styled.div`
  margin: 8px;

  display: grid;
  grid-template-areas:
    "select .     .      .      ."
    "input  input .      output output"
    "input  input status output output"
    "input  input status output output"
    "input  input run    output output"
    "input  input label  output output"
    "input  input label  output output"
    "input  input .      output output";
  grid-template-columns: 3fr 3fr 2fr 3fr 3fr;
  grid-template-rows: 0.5fr 3.5fr 3.5fr 0.5fr 2fr 0.5fr 3.5fr 3.5fr;
  grid-gap: 15px 30px;

  max-height: 75vh;
`;

const Playground = () => {
  const selectState = useState(SELECT_OPTIONS.find((option) => option.selected));
  const inputState = useState(SELECT_OPTIONS.find((option) => option.selected).predefinedInput);
  const statusState = useState(STATUS.READY);
  const labelState = useState(null);
  const outputState = useState(``);

  const onSelectChanged = (selectedOption) => {
    selectState[1](selectedOption);
    inputState[1](selectedOption.predefinedInput);
  };

  const cleanup = () => {
    labelState[1](null);
    outputState[1](``);
  };

  const runInput = async () => {
    cleanup();

    //const {assertion, error} = await playgroundUtils.runInput({inputState, statusState});
    const assertion = undefined;
    const error = 'Error';

    if (assertion) {
      labelState[1](LABELS.REPRODUCIBLE);
      outputState[1](assertion);
    } else if (error) {
      labelState[1](LABELS.BROKEN);
      outputState[1](error);
    } else {
      labelState[1](LABELS.UNREPRODUCIBLE);
    }
  };

  return (
    <Container>
      <PlaygroundSelect selectState={selectState} options={SELECT_OPTIONS} onSelectChanged={onSelectChanged} />
      <PlaygroundInput inputState={inputState} />
      <PlaygroundStatus statusState={statusState} />
      <PlaygroundRunButton runInput={runInput} />
      <PlaygroundResults labelState={labelState} />
      <PlaygroundOutput outputState={outputState} />
    </Container>
  );
};

// eslint-disable-next-line arca/no-default-export
export default Playground;
