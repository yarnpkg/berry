import styled                    from '@emotion/styled';
import {navigate}                from 'gatsby';
import {IoIosSearch, IoIosClose} from "react-icons/io";
import {connectSearchBox}        from 'react-instantsearch-dom';
import React, {useState}         from 'react';

const SearchForm = styled.form`
  display: flex;
  background-color: white;
  border-radius: 0.2em;
  padding: 0.2em;
  min-height: 38.8px;
  transition: box-shadow 0.4s ease, background 0.4s ease;
  box-shadow: 0 2px 2px 0 rgba(85,95,110,0.4);
  width: 1140px;
  max-width: 100%;
  margin: 0 auto 0 auto;
}`;

const SearchInput = styled.input`
  &:focus {
    outline: none;
  }
  &::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }
  &::placeholder {
    color: #46a7d4;
    font-family: inherit;
    font-style: italic;
  }
  -webkit-appearance: none;
  order: 2;
  flex-grow: 1;
  background: none;
  border: none;
  border-radius: 0;
  font: inherit;
  color: #2c8ebb;
  margin-left: 0.5em;
  text-overflow: ellipsis;
`;

const IconButton = styled.button`
  &:focus {
    outline: none;
  }
  font-size: 100%;
  width: 2em;
  height: 2em;
  background: none;
  border: none;
  position: relative;
  cursor: pointer;

  svg {
    top: 0.1em;
    left: 0;
    width: 1.8em;
    height: 1.8em;
    fill: #2c8ebb;
    position: absolute;
  }
`;

const SubmitButton = styled(IconButton)`
  order: 1;
  top: -2px;
  svg {
    top: 0.2em;
    left: 0.2em;
  }
`;

const ResetButton = styled(IconButton)`
  order: 2;
`;

const RawSearchBox = ({currentRefinement, refine, autoFocus}) => {
  const [active, setActive] = useState(false);

  const onSubmit = e => {
    e.preventDefault();
    e.stopPropagation();

    navigate(`/package/${currentRefinement}`);
  };

  return (
    <SearchForm noValidate action="" role="search" onSubmit={onSubmit}>
      <SearchInput
        placeholder="Search packages (i.e. babel, webpack, react…)"
        autoFocus={autoFocus}
        active={active}
        type="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        required="required"
        maxLength="512"
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        value={currentRefinement}
        onChange={event => refine(event.currentTarget.value)}
        size="1"
      />
      <SubmitButton type="submit" title="Submit your search query."><IoIosSearch/></SubmitButton>
      <ResetButton type="reset" title="Clear the search query." onClick={() => refine(``)}><IoIosClose/></ResetButton>
    </SearchForm>
  );
};

export const SearchBox = connectSearchBox(RawSearchBox);
