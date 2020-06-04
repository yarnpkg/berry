import styled                                        from '@emotion/styled';
import Loadable                                      from '@loadable/component';
import useComponentSize                              from '@rehooks/component-size';
import React, {useCallback, useLayoutEffect, useRef} from 'react';

const MonacoEditor = Loadable(() => import(`react-monaco-editor`));

const InputContainer = styled.div`
  position: relative;

  width: 100%;
  height: 60vh;
`;

const FloatingContainer = styled.div`
  position: absolute;

  width: 100%;
  height: 100%;
`;

const PlaygroundInput = ({value, onChange}) => {
  const containerRef = useRef(null);
  const containerSize = useComponentSize(containerRef);

  const editorRef = useRef(null);

  const editorDidMount = useCallback(editor => {
    editorRef.current = editor;
  }, []);

  useLayoutEffect(() => {
    if (editorRef.current !== null) {
      editorRef.current.layout({
        width: containerSize.width,
        height: containerSize.height,
      });
    }
  }, [
    editorRef.current,
    containerSize.width,
    containerSize.height,
  ]);

  return (
    <InputContainer ref={containerRef}>
      <FloatingContainer>
        <MonacoEditor
          value={value}
          onChange={onChange}
          language={`javascript`}
          theme={`vs-dark`}
          editorDidMount={editorDidMount}
          options={{
            scrollBeyondLastLine: false,
          }}
        />
      </FloatingContainer>
    </InputContainer>
  );
};

// eslint-disable-next-line arca/no-default-export
export default PlaygroundInput;
