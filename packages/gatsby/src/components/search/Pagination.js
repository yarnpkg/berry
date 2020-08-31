import styled                        from '@emotion/styled';
import {Pagination as AisPagination} from 'react-instantsearch-dom';
import React                         from 'react';

const PaginationContainer = styled.div`
  height: 3rem;
  margin: 2em auto;
  text-align: center;

  ul {
    display: inline-block;
    list-style-type: none;
    padding: 0;
  }

  li {
    float: left;
  }

  .ais-Pagination-item--disabled {
    visibility: visible;
    opacity: 0.3;
    cursor: default;
  }

  .ais-Pagination-link--selected {
    color: #fff;
    background-color: #2c8ebb;
    border-color: #2c8ebb;
    cursor: default;
  }

  a,  .ais-Pagination-item--disabled span {
    padding: .5rem .75rem;
    margin-left: -1px;
    line-height: 1.25;
    color: #117cad;
    background-color: #fff;
    border: 1px solid #ddd;
 }

 a.ais-Pagination-link:hover {
    &.ais-Pagination-link--selected:hover {
      color: #fff;
      cursor: default;
      background-color: #2c8ebb;
      border-color: #2c8ebb;
    }
    color: #0a4a67;
    text-decoration: none;
    background-color: #eceeef;
    border-color: #ddd;
  }

  li.ais-Pagination-item:first-of-type .ais-Pagination-link {
    border-bottom-left-radius: .25rem;
    border-top-left-radius: .25rem;
  }

  li.ais-Pagination-item:last-of-type .ais-Pagination-link {
    border-bottom-right-radius: .25rem;
    border-top-right-radius: .25rem;
  }
`;

export const Pagination = ({pagination}) => (
  <PaginationContainer>
    {pagination ? (
      <AisPagination showFirst={false} showLast={false} scrollTo={true} />
    ) : (
      <div style={{height: `3rem`}} />
    )}
  </PaginationContainer>
);


