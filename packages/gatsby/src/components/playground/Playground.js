import styled                                   from '@emotion/styled';
import ReactTooltip                             from 'react-tooltip';
import React, {useState}                        from 'react';

import * as playgroundUtils                     from '../../utils/playgroundUtils';

import PlaygroundButton                         from './PlaygroundButton';
import PlaygroundInput                          from './PlaygroundInput';
import PlaygroundOutput                         from './PlaygroundOutput';
import PlaygroundResults                        from './PlaygroundResults';
import PlaygroundSelect                         from './PlaygroundSelect';

import {DEFAULT_OUTPUT, SELECT_OPTIONS, LABELS} from './constants';

const Container = styled.div`
`;

const Toolbar = styled.div`
  display: flex;

  margin: 10px;
  margin-bottom: 5px;

  > * {
    margin-right: 10px;
  }
`;

const Display = styled.div`
  display: flex;

  width: 100%;

  padding: 5px;
`;

const Slot = styled.div`
  width: 50%;

  padding: 5px;

  flex: none;
`;

const Left = styled(Slot)`
`;

const Right = styled(Slot)`
`;

const Playground = () => {
  const [select, setSelect] = useState(SELECT_OPTIONS.find((option) => option.selected));
  const [input, setInput] = useState(SELECT_OPTIONS.find((option) => option.selected).predefinedInput);
  const [label, setLabel] = useState(LABELS.DEFAULT);
  const [output, setOutput] = useState(DEFAULT_OUTPUT);

  const onSelectChanged = (selectedOption) => {
    setSelect(selectedOption);
    setInput(`${selectedOption.predefinedInput}\n`);
  };

  const cleanup = () => {
    setLabel(LABELS.DEFAULT);
    setOutput(DEFAULT_OUTPUT);
  };

  const runInput = async () => {
    cleanup();

    const {assertion, error} = await playgroundUtils.runInput(input, {setLabel});

    if (assertion) {
      setLabel(LABELS.REPRODUCIBLE);
      setOutput(assertion);
    } else if (error) {
      setLabel(LABELS.BROKEN);
      setOutput(error);
    } else {
      setLabel(LABELS.UNREPRODUCIBLE);
      setOutput(DEFAULT_OUTPUT);
    }
  };

  return (
    <Container>
      <Toolbar>
        <PlaygroundSelect select={select} options={SELECT_OPTIONS} onSelectChanged={onSelectChanged} />
        <PlaygroundButton onClick={runInput} children={`Run`} />
        <PlaygroundResults label={label} />
      </Toolbar>
      <Display>
        <Left>
          <PlaygroundInput value={input} onChange={setInput} />
        </Left>
        <Right>
          <PlaygroundOutput value={output} />
        </Right>
      </Display>
      <ReactTooltip
        place={`top`}
      />
    </Container>
  );
};

// eslint-disable-next-line arca/no-default-export
export default Playground;
