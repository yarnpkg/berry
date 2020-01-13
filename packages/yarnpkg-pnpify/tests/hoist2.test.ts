import {hoist, HoisterTree, HoisterResult} from '../sources/hoist2';

const toTree = (obj: any): HoisterTree => {
  const {name, reference, deps, peerNames, ...meta} = obj;
  return {
    name,
    reference: reference || '',
    deps: new Set((deps || []).map((dep: any) => toTree(dep))),
    peerNames: new Set(peerNames || []),
    ...meta,
  };
};

const toResult = (obj: any): HoisterResult => {
  const {name, reference, deps, ...meta} = obj;
  return {
    name,
    reference: reference || '',
    deps: new Set(Array.from(deps || []).map((dep: any) => toResult(dep))),
    ...meta,
  };
};

describe('hoist', () => {
  it('should do very basic hoisting', () => {
    // . → A → B
    // should be hoisted to:
    // . → A
    //   → B
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
        }],
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
      }, {
        name: 'B',
      }],
    }));
  });

  it('should preserve original metadata during hoisting', () => {
    // . → A → B
    // should be hoisted to:
    // . → A
    //   → B
    const tree = toTree({
      name: '.',
      meta1: 'dot',
      deps: [{
        name: 'A',
        meta2: 'abc',
        deps: [{
          name: 'B',
          meta3: 'def',
        }],
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      meta1: 'dot',
      deps: [{
        name: 'A',
        meta2: 'abc',
      }, {
        name: 'B',
        meta3: 'def',
      }],
    }));
  });

  it('should not hoist different package with the same name', () => {
    // . → A → B@X
    //   → B@Y
    // should not be changed
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
        }],
      }, {
        name: 'B',
        reference: 'Y',
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
        }],
      }, {
        name: 'B',
        reference: 'Y',
      }],
    }));
  });

  it('should not hoist package that has several versions on the same tree path', () => {
    // . → A → B@X → C → B@Y
    // should be hoisted to:
    // . → A
    //   → B@X
    //   → C → B@Y
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
          deps: [{
            name: 'C',
            deps: [{
              name: 'B',
              reference: 'Y',
            }],
          }],
        }],
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
      }, {
        name: 'B',
        reference: 'X',
      }, {
        name: 'C',
        deps: [{
          name: 'B',
          reference: 'Y',
        }],
      }],
    }));
  });

  it('should perform deep hoisting', () => {
    // . → A → B@X → C@Y
    //       → C@X
    //   → B@Y
    //   → C@X
    // should be hoisted to:
    // . → A → B@X → C@Y
    //   → B@Y
    //   → C@X
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
          deps: [{
            name: 'C',
            reference: 'Y',
          }],
        }, {
          name: 'C',
          reference: 'X',
        }],
      }, {
        name: 'B',
        reference: 'Y',
      }, {
        name: 'C',
        reference: 'X',
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
          deps: [{
            name: 'C',
            reference: 'Y',
          }],
        }],
      }, {
        name: 'B',
        reference: 'Y',
      }, {
        name: 'C',
        reference: 'X',
      }],
    }));
  });

  it('should tolerate self-dependencies', () => {
    // . → . → A → A → B@X → B@X → C@Y
    //               → C@X
    //   → B@Y
    //   → C@X
    // should be hoisted to:
    // . → A → B@X → C@Y
    //   → B@Y
    //   → C@X
    const tree = toTree({
      name: '.',
      deps: [{
        name: '.',
      }, {
        name: 'A',
        deps: [{
          name: 'A',
        }, {
          name: 'B',
          reference: 'X',
          deps: [{
            name: 'B',
            reference: 'X',
          }, {
            name: 'C',
            reference: 'Y',
          }],
        }, {
          name: 'C',
          reference: 'X',
        }],
      }, {
        name: 'B',
        reference: 'Y',
      }, {
        name: 'C',
        reference: 'X',
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
          deps: [{
            name: 'C',
            reference: 'Y',
          }],
        }],
      }, {
        name: 'B',
        reference: 'Y',
      }, {
        name: 'C',
        reference: 'X',
      }],
    }));
  });

  it('should honor package popularity when hoisting', () => {
    // . → A → B@X
    //   → C → B@X
    //   → D → B@Y
    //   → E → B@Y
    //   → F → G → B@Y
    // should be hoisted to:
    // . → A → B@X
    //   → C → B@X
    //   → D
    //   → E
    //   → F
    //   → G
    //   → B@Y
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
        }],
      }, {
        name: 'C',
        deps: [{
          name: 'B',
          reference: 'X',
        }],
      }, {
        name: 'D',
        deps: [{
          name: 'B',
          reference: 'Y',
        }],
      }, {
        name: 'E',
        deps: [{
          name: 'B',
          reference: 'Y',
        }],
      }, {
        name: 'F',
        deps: [{
          name: 'G',
          deps: [{
            name: 'B',
            reference: 'Y',
          }],
        }],
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
        }],
      }, {
        name: 'C',
        deps: [{
          name: 'B',
          reference: 'X',
        }],
      }, {
        name: 'D',
      }, {
        name: 'E',
      }, {
        name: 'F',
      }, {
        name: 'G',
      }, {
        name: 'B',
        reference: 'Y',
      }],
    }));
  });

  it('should honor peer dependencies', () => {
    // . → A → B ⟶ D@X
    //       → D@X
    //   → D@Y
    // should be hoisted to (A and B should share single D@X dependency):
    // . → A → B
    //     → D@X
    //   → D@Y
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          deps: [{
            name: 'D',
            reference: 'X',
          }],
          peerNames: ['D'],
        }, {
          name: 'D',
          reference: 'X',
        }],
      }, {
        name: 'D',
        reference: 'Y',
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
        }, {
          name: 'D',
          reference: 'X',
        }],
      }, {
        name: 'D',
        reference: 'Y',
      }],
    }));
  });

  it('should hoist deps after hoisting peer dep', () => {
    // . → A → B ⟶ D@X
    //     → D@X
    // should be hoisted to (B should be hoisted because its inherited dep D@X was hoisted):
    // . → A
    //   → B
    //   → D@X
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          deps: [{
            name: 'D',
            reference: 'X',
          }],
          peerNames: ['D'],
        }, {
          name: 'D',
          reference: 'X',
        }],
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
      }, {
        name: 'B',
      }, {
        name: 'D',
        reference: 'X',
      }],
    }));
  });

  it('should honor unhoisted peer dependencies', () => {
    // . → A ⟶ B@X
    //     → C@X → B@Y
    //   → B@X
    //   → C@Y
    // should be hoisted to:
    // . → A
    //     → C@X → B@Y
    //   → B@X
    //   → C@Y
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
        }, {
          name: 'C',
          reference: 'X',
          deps: [{
            name: 'B',
            reference: 'Y',
          }],
        }],
        peerNames: ['B'],
      }, {
        name: 'B',
        reference: 'X',
      }, {
        name: 'C',
        reference: 'Y',
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'C',
          reference: 'X',
          deps: [{
            name: 'B',
            reference: 'Y',
          }],
        }],
      }, {
        name: 'B',
        reference: 'X',
      }, {
        name: 'C',
        reference: 'Y',
      }],
    }));
  });

  it('should honor peer dependency promise for the same version of dependency', () => {
    // . → A → B → C
    //   ⟶ B
    // should be hoisted to (B@X must not be hoisted to the top):
    // . → A → B
    //   → C
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          deps: [{
            name: 'C',
          }],
        }],
      }, {
        name: 'B',
      }],
      peerNames: ['B'],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
        }],
      }, {
        name: 'C',
      }],
    }));
  });

  it('should hoist different copies of a package independently', () => {
    // . → A → B@X → C@X
    //     → C@Y
    //   → D → B@X → C@X
    //   → B@Y
    //   → C@Z
    // should be hoisted to (top C@X instance must not be hoisted):
    // . → A → B@X → C@X
    //     → C@Y
    //   → D → B@X
    //     → C@X
    //   → B@Y
    //   → C@Z
    const BX = {
      name: 'B',
      reference: 'X',
      deps: [{
        name: 'C',
        reference: 'X',
      }],
    };
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [BX, {
          name: 'C',
          reference: 'Y',
        }],
      }, {
        name: 'D',
        deps: [BX],
      }, {
        name: 'B',
        reference: 'Y',
      }, {
        name: 'C',
        reference: 'Z',
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          reference: 'X',
          deps: [{
            name: 'C',
            reference: 'X',
          }],
        }, {
          name: 'C',
          reference: 'Y',
        }],
      }, {
        name: 'D',
        deps: [{
          name: 'B',
          reference: 'X',
        }, {
          name: 'C',
          reference: 'X',
        }],
      }, {
        name: 'B',
        reference: 'Y',
      }, {
        name: 'C',
        reference: 'Z',
      }],
    }));
  });

  it('should make sure the deps are satisfied when they were hoisted', () => {
    // . → A → B → C@X
    //   → C@Y
    // should be hoisted to (B cannot be hoisted to the top)
    // . → A → B
    //       → C@X
    //   → C@Y
    const tree = toTree({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
          deps: [{
            name: 'C',
            reference: 'X',
          }],
        }],
      }, {
        name: 'C',
        reference: 'Y',
      }],
    });
    expect(hoist(tree)).toEqual(toResult({
      name: '.',
      deps: [{
        name: 'A',
        deps: [{
          name: 'B',
        }, {
          name: 'C',
          reference: 'X',
        }],
      }, {
        name: 'C',
        reference: 'Y',
      }],
    }));
  });
});
