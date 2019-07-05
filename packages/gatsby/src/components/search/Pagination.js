import React                                   from 'react';
import {Pagination}                            from 'react-instantsearch-dom';

const Pag = ({ pagination }) => (
  <div className="d-flex">
    {pagination ? (
      <Pagination showFirst={false} showLast={false} scrollTo={true} />
    ) : (
      <div style={{ height: '3rem' }} />
    )}
  </div>
);

export default Pag;
