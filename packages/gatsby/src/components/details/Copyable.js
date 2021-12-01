import styled                    from '@emotion/styled';
import React, {useState, useRef} from 'react';

import IcoCopyDefault            from '../../images/detail/ico-copy-default.svg';
import IcoCopySuccess            from '../../images/detail/ico-copy-success.svg';

const images = {
  default: IcoCopyDefault,
  success: IcoCopySuccess,
};

const Button = styled.button`
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  background: none;
  border: none;
  border-radius: 0;
  color: #666666;
  white-space: nowrap;
  cursor: pointer;
  font-size: 0.9em;
  padding: 0;
  margin: 0;

  &:focus {
    outline: none;
  }

  img {
    margin-right: 0.2em;
    height: 1em;
    width: 2em;
    opacity: 0.5;
    vertical-align: middle;
    border-style: none;
    line-height: inherit;
  }
`;

const CopyableContent = styled.section`
  display: flex;
  width: 100%;
  margin: 0;
  font-size: 1em;
  color: #666666;
  whitespace: no-wrap;
  line-height: 1.5;
  overflow: hidden;

  code {
    padding: 0.2rem 0.4rem;
  }

  a {
    color: #666666;
    &:hover {
      color: #0a4a67;
      text-decoration: underline;
    }
  }

  object {
    display: flex;
    align-items: center;
  }

  button {
    line-height: inherit;
    vertical-align: middle;
    &:hover {
      color: #666666;
      text-decoration: none;
    }
  }

  .text-hide {
    font: 0/0 a;
    color: transparent;
    text-shadow: none;
    background-color: transparent;
    border: 0;
  }
`;

export const Copyable = ({tag = `div`, pre, children}) => {
  const [statusImage, setImage] = useState(images.default);

  const copy = (toCopy, timeout = 2000) => {
    const setAndUnset = ({image, timeout}) => {
      setImage(image);
      setTimeout(() => {
        setImage(images.default);
      }, timeout);
    };

    const range = document.createRange();
    range.selectNode(toCopy);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    try {
      // Now that we've selected the anchor text, execute the copy command
      const copy = document.execCommand(`copy`);
      window.getSelection().removeAllRanges();
      if (copy === true) {
        setAndUnset({image: images.success, timeout});
      }
    } catch (err) {
      setImage(images.default);
    }
  };

  const copyTextRef = useRef();

  const Content = styled(tag)`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-size-adjust: 100%;
    flex-grow: 1;
  `;

  return (
    <CopyableContent>
      <Content>
        {pre}
        <span ref={copyTextRef}>{children}</span>
      </Content>
      <object type={`stop/styling`}>
        <Button onClick={event => {
          event.preventDefault();
          copy(copyTextRef.current);
        }}>
          <img src={statusImage} alt={``}/>
        copy
        </Button>
      </object>
    </CopyableContent>
  );
};
