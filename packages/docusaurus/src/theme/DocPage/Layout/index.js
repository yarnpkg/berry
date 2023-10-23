/* eslint-disable no-undef */
import {useLocation}                                 from '@docusaurus/router';
import {useDocsSidebar}                              from '@docusaurus/theme-common/internal';
import BackToTopButton                               from '@theme/BackToTopButton';
import DocPageLayoutMain                             from '@theme/DocPage/Layout/Main';
import DocPageLayoutSidebar                          from '@theme/DocPage/Layout/Sidebar';
import Layout                                        from '@theme/Layout';
import React, {useEffect, useLayoutEffect, useState} from 'react';

import styles                                        from './styles.module.css';

function getReactNodeFromDomNode(domNode) {
  const fiberKey = Object.keys(domNode).find(key => key.startsWith(`__reactFiber$`));
  if (!fiberKey)
    throw new Error(`Assertion failed: Couldn't find the React node associated with the DOM node`);

  const {type: Type, memoizedProps} = domNode[fiberKey];
  return <Type {...memoizedProps}/>;
}

function getSuggestedModal({onExit}) {
  if (!location.hash)
    return null;

  const navigation = window.performance.getEntriesByType(`navigation`);
  if (navigation.length > 0 && navigation[0].type !== `navigate` && window.location.hostname !== `localhost`)
    return null;

  const target = document.getElementById(location.hash.slice(1));
  if (!target)
    return null;

  let adjustedTarget = target;
  while (adjustedTarget && adjustedTarget.tagName !== `H2`)
    adjustedTarget = adjustedTarget.previousSibling;

  if (!adjustedTarget)
    return null;

  const reactNodes = [];

  const copy = document.createElement(`div`);
  copy.classList.add(`markdown`);

  let current = target;
  do {
    reactNodes.push(getReactNodeFromDomNode(current));
    current = current.nextSibling;
  } while (current && current.tagName !== target.tagName);

  return <FocusModal onExit={onExit} children={<>{reactNodes}</>}/>;
}

const FocusModal = ({onExit, children}) => {
  useEffect(() => {
    const keyDownHandler = event => {
      if (event.key === `Escape`) {
        onExit();
      }
    };

    document.addEventListener(`keydown`, keyDownHandler);
    return () => {
      document.removeEventListener(`keydown`, keyDownHandler);
    };
  }, []);

  return (
    <div className={styles.modalParent}>
      <div className={styles.modalOverlay} onClick={() => onExit()}/>
      <div className={styles.modalContent}>
        <div className={`markdown`}>
          {children}
        </div>
      </div>
    </div>
  );
};

const useFocusModal = () => {
  const location = useLocation();
  const [modal, setModal] = useState(null);

  useLayoutEffect(() => {
    setModal(getSuggestedModal({onExit: () => setModal(null)}));
  }, [location.pathname]);

  return modal;
};

// eslint-disable-next-line arca/no-default-export
export default function DocPageLayout({title, children}) {
  const sidebar = useDocsSidebar();
  const [hiddenSidebarContainer, setHiddenSidebarContainer] = useState(false);

  const modal = useFocusModal();

  return (
    <Layout title={title} wrapperClassName={styles.docsWrapper}>
      <BackToTopButton />
      {modal}
      <div className={styles.docPage}>
        {sidebar && (
          <DocPageLayoutSidebar
            sidebar={sidebar.items}
            hiddenSidebarContainer={hiddenSidebarContainer}
            setHiddenSidebarContainer={setHiddenSidebarContainer}
          />
        )}
        <DocPageLayoutMain hiddenSidebarContainer={hiddenSidebarContainer}>
          {children}
        </DocPageLayoutMain>
      </div>
    </Layout>
  );
}
