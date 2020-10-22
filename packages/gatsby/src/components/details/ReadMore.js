import styled                               from '@emotion/styled';
import React, {useState, useRef, useEffect} from 'react';

import IcoReadMore                          from '../../images/detail/ico-readmore.svg';

export const ReadMoreButton = styled.button`
  padding: 0.3em 0.8em;
  padding-right: 0;
  border-radius: 0.2em;
  color: #666;
  line-height: 1.5em;
  font-size: 100%;
  border: 1px solid #cbcbcb;
  background-color: transparent;
  cursor: pointer;
  &:Focus {
    outline: none;
  }
`;

export const ReadMoreIcon = styled.img`
  width: 0.8em;
  margin: 0 1em;
  vertical-align: middle;
  border-style: none;
  transform: ${({collapsed}) => collapsed ? `` : `rotate(180deg)`}
`;

const ReadMoreContent = styled.div`
  &.collapsed:after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 250px;
    width: 100%;
    box-shadow: inset 0 -100px 60px -60px white;
    pointer-events: none;
  }
  overflow: hidden;
  position: relative;
  margin-bottom: 0.2em;
  max-height: ${({collapsed, contentHeight}) => collapsed ? `${contentHeight}px` : ``}
`;

const ReadMoreContainer = styled.div`
  .collapsed {
    overflow: hidden;
    position: relative;
    margin-bottom: 0.2em;
  }

  h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6 {
    margin-top: 0;
    margin-bottom: .5rem;
    font-weight: 600;
    line-height: 1.1;
  }

  h1, .h1 {
    font-size: 1.5rem;
  }

  h2, .h2, h3, .h3, h4, .h4, h5, .h5, h6, .h6  {
    font-size: 1.25rem;
  }

  p {
    margin-top: 0;
    margin-bottom: .5rem;
  }

  pre {
    max-width: 100%;
    margin-bottom: 1.2rem;
    border-radius: 3px;
    padding: 0.6rem 1.2rem;
    overflow-x: auto;
    background: #292b2c;
    -webkit-font-smoothing: antialiased;
    border-left: 4px solid #2c8ebb;
    color: #ddd;

    code {
      padding: 0;
      background-color: transparent;
      border-radius: 0;
    }
  }

  blockquote {
    padding: .5rem 1rem;
    margin: 0 0 1rem;
    font-size: 1.25rem;
    border-left: .25rem solid #eceeef;
  }

  img {
    max-width: 100%;
  }
`;

export const ReadMore = ({text, height, children}) => {
  const [state, setState] = useState({
    collapsed: true,
    collapsible: true,
  });

  const {collapsed, collapsible} = state;

  const contentRef = useRef();

  const toggleCollapse = () => setState({
    collapsed: !collapsed,
    collapsible,
  });

  useEffect(() => {
    const contentHeight = contentRef.current.getBoundingClientRect().height;
    if (collapsible && contentHeight < height) {
      setState({
        collapsible: false,
        collapsed: false,
      });
    }
  }, [height, collapsible]);

  return (
    <ReadMoreContainer className={collapsed ? `collapsed` : ``}>
      <ReadMoreContent
        className={collapsed ? `collapsed` : ``}
        collapsed={collapsed}
        contentHeight={height}
        ref={contentRef}
      >
        {children}
      </ReadMoreContent>
      {collapsible && (
        <ReadMoreButton onClick={toggleCollapse}>
          {collapsed ? text : `Collapse`}
          <ReadMoreIcon
            src={IcoReadMore}
            alt={collapsed ? text : `Collapse`}
            collapsed={collapsed}
          />
        </ReadMoreButton>
      )}
    </ReadMoreContainer>
  );
};

ReadMore.defaultProps = {
  height: 250,
  className: ``,
};
