/* eslint-disable no-undef */
import {useLocation}                                 from '@docusaurus/router';
import {useDocsSidebar}                              from '@docusaurus/theme-common/internal';
import BackToTopButton                               from '@theme/BackToTopButton';
import DocRootLayoutMain                             from '@theme/DocRoot/Layout/Main';
import DocRootLayoutSidebar                          from '@theme/DocRoot/Layout/Sidebar';
import type {Props}                                  from '@theme/DocRoot/Layout';
import type {PropsWithChildren}                      from 'react';
import React, {useEffect, useLayoutEffect, useState} from 'react';

import styles                                        from './styles.module.css';

function getReactNodeFromDomNode(domNode: Element) {
  const fiberKey = Object.keys(domNode).find(key => key.startsWith(`__reactFiber$`));
  if (!fiberKey)
    throw new Error(`Assertion failed: Couldn't find the React node associated with the DOM node`);

  // @ts-expect-error
  const {type: Type, memoizedProps} = domNode[fiberKey];
  return <Type {...memoizedProps}/>;
}

function getSuggestedModal({onExit}: {onExit: () => void}) {
  if (!location.hash)
    return null;

  const [navigation] = window.performance.getEntriesByType(`navigation`);
  if (navigation instanceof PerformanceNavigationTiming && navigation.type !== `navigate` && window.location.hostname !== `localhost`)
    return null;

  const target = document.getElementById(location.hash.slice(1));
  if (!target)
    return null;

  let adjustedTarget: Element | null = target;
  while (adjustedTarget && adjustedTarget.tagName !== `H2`)
    adjustedTarget = adjustedTarget.previousElementSibling;

  if (!adjustedTarget)
    return null;

  const reactNodes = [];

  const copy = document.createElement(`div`);
  copy.classList.add(`markdown`);

  let current: Element | null = target;
  do {
    reactNodes.push(getReactNodeFromDomNode(current));
    current = current.nextElementSibling;
  } while (current && current.tagName !== target.tagName);

  return <FocusModal onExit={onExit} children={<>{reactNodes}</>}/>;
}

const FocusModal = ({onExit, children}: PropsWithChildren<{onExit: () => void}>) => {
  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
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
  const [modal, setModal] = useState<JSX.Element | null>(null);

  useLayoutEffect(() => {
    setModal(getSuggestedModal({onExit: () => setModal(null)}));
  }, [location.pathname]);

  return modal;
};

// eslint-disable-next-line arca/no-default-export
export default function DocRootLayout({children}: Props) {
  const sidebar = useDocsSidebar();
  const [hiddenSidebarContainer, setHiddenSidebarContainer] = useState(false);

  const modal = useFocusModal();

  return (
    <div className={styles.docsWrapper}>
      <BackToTopButton />
      {modal}
      <div className={styles.docRoot}>
        {sidebar && (
          <DocRootLayoutSidebar
            sidebar={sidebar.items}
            hiddenSidebarContainer={hiddenSidebarContainer}
            setHiddenSidebarContainer={setHiddenSidebarContainer}
          />
        )}
        <DocRootLayoutMain hiddenSidebarContainer={hiddenSidebarContainer}>
          {children}
        </DocRootLayoutMain>
      </div>
    </div>
  );
}
