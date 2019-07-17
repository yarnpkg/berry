import React, {useState, useRef} from 'react';
import styled                    from '@emotion/styled';

import IcoCopyDefault            from '../../images/detail/ico-copy-default.svg';
import IcoCopySuccess            from '../../images/detail/ico-copy-success.svg';

const images = {
  default: IcoCopyDefault,
  success: IcoCopySuccess
}

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
  padding: 0;
  font-size: 16px;

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

const CopyableContent = styled.div`
  display: flex;
  font-size: 1em;
  color: #666666;
  whitespace: no-wrap;
  background-color: inherit;
  padding: 0;
  margin: 0;
  width: calc(100% - 2.2em);

  a {
    color: #666666;
    &:hover {
      color: #0a4a67;
      text-decoration: underline;
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

const Copyable = ({ tag = 'div', pre, children }) => {
  const [statusImage, setImage] = useState(images.default);

  const copy = (toCopy, timeout = 2000) => {
    const setAndUnset = ({ image, timeout }) => {
      setImage(image);
      setTimeout(() => {
        setImage(images.default);
      }, timeout);
    };

    let range = document.createRange();
    range.selectNode(toCopy);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    try {
      // Now that we've selected the anchor text, execute the copy command
      const copy = document.execCommand('copy');
      window.getSelection().removeAllRanges();
      if (copy === true) {
        setAndUnset({ image: images.success, timeout });
      }
    } catch (err) {
      setImage(images.default);
    }
  }

  const copyTextRef = useRef();

  const Content = styled(tag)`
    flex-grow: 1;
  `;

  return (
    <CopyableContent>
      <Content className="copyable--content">
        {pre}
        <span ref={copyTextRef}>{children}</span>
      </Content>
      <Button onClick={() => copy(copyTextRef.current)}>
        <img src={statusImage} alt=""/>
        copy
      </Button>
    </CopyableContent>
  );
};

export default Copyable;
