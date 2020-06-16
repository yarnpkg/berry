import styled from '@emotion/styled';
import Select from 'react-select';
import React  from 'react';

const StyledSelect = styled(Select)`
  width: 320px;
`;

const PlaygroundSelect = ({select, options, onSelectChanged}) => (
  <StyledSelect
    value={select}
    onChange={(selectedOption) => onSelectChanged(selectedOption)}
    options={options}
  >
  </StyledSelect>
);

// eslint-disable-next-line arca/no-default-export
export default PlaygroundSelect;
