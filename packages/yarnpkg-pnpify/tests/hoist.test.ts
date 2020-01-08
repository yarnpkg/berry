import {hoist, HoisterPackageTree} from '../sources/hoist';

describe('hoist', () => {
  it('should do very basic hoisting', () => {
    // . → A → B
    // should be hoisted to:
    // . → A
    //   → B
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set(),
      }, {
        pkgId: 2, // B
        deps: new Set(),
      }]),
    });
  });

  it('should not hoist different package with the same name', () => {
    // . → A → B@X
    //   → B@Y
    // should not be changed
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
      {name: 'B'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 3, // B@Y
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set(),
        }]),
      }, {
        pkgId: 3, // B@Y
        deps: new Set(),
      }]),
    });
  });

  it('should not hoist package that has several versions on the same tree path', () => {
    // . → A → B@X → C → B@Y
    // should be hoisted to:
    // . → A
    //   → B@X
    //   → C → B@Y
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
      {name: 'C'},
      {name: 'B'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set([{
            pkgId: 3, // C
            deps: new Set([{
              pkgId: 4, // B@Y
              deps: new Set<HoisterPackageTree>(),
              peerDepIds: new Set<number>(),
            }]),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set(),
      }, {
        pkgId: 2, // B@X
        deps: new Set(),
      }, {
        pkgId: 3, // C
        deps: new Set([{
          pkgId: 4, // B@Y
          deps: new Set<HoisterPackageTree>(),
        }]),
      }]),
    });
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
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
      {name: 'B'},
      {name: 'C'},
      {name: 'C'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set([{
            pkgId: 5, // C@Y
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }, {
          pkgId: 4, // C@X
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 3, // B@Y
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 4, // C@X
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set([{
            pkgId: 5, // C@Y
            deps: new Set(),
          }]),
        }]),
      }, {
        pkgId: 3, // B@Y
        deps: new Set(),
      }, {
        pkgId: 4, // C@X
        deps: new Set(),
      }]),
    });
  });

  it('should tolerate any cyclic dependencies', () => {
    // . → . → A → A → B@X → B@X → C@Y
    //               → C@X
    //   → B@Y
    //   → C@X
    // should be hoisted to:
    // . → . → A → B@X → C@Y
    //   → B@Y
    //   → C@X
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
      {name: 'B'},
      {name: 'C'},
      {name: 'C'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 0, // . self-ref
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 1, // A self-ref
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }, {
          pkgId: 2, // B@X
          deps: new Set([{
            pkgId: 2, // B@X self-ref
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }, {
            pkgId: 4, // C@Y
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }, {
          pkgId: 3, // C@X
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 3, // B@Y
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 4, // C@X
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 0, // .
        deps: new Set(),
      }, {
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set(),
        }]),
      }, {
        pkgId: 4, // C@Y
        deps: new Set(),
      }, {
        pkgId: 3, // C@X
        deps: new Set(),
      }]),
    });
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
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
      {name: 'B'},
      {name: 'C'},
      {name: 'D'},
      {name: 'E'},
      {name: 'F'},
      {name: 'G'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 4, // C
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 5, // D
        deps: new Set([{
          pkgId: 3, // B@Y
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 6, // E
        deps: new Set([{
          pkgId: 3, // B@Y
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 7, // F
        deps: new Set([{
          pkgId: 8, // G
          deps: new Set([{
            pkgId: 3, // B@Y
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set(),
        }]),
      }, {
        pkgId: 4, // C
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set(),
        }]),
      }, {
        pkgId: 5, // D
        deps: new Set(),
      }, {
        pkgId: 6, // E
        deps: new Set(),
      }, {
        pkgId: 7, // F
        deps: new Set(),
      }, {
        pkgId: 8, // G
        deps: new Set(),
      }, {
        pkgId: 3, // B@Y
        deps: new Set(),
      }]),
    });
  });

  it('should honor peer dependencies', () => {
    // . → A → B ⟶ D@X
    //     → C → D@Y
    //     → D@X
    // should be hoisted to (A and B should share single D@X dependency):
    // . → A → B
    //     → D@X
    //   → C
    //   → D@Y
    const packages = [
      {name: '.'}, // 0 - .
      {name: 'A'}, // 1 - A
      {name: 'B'}, // 2 - B
      {name: 'C'}, // 3 - C
      {name: 'D'}, // 4 - D@X
      {name: 'D'}, // 5 - D@Y
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set([
            4, // D@X
          ]),
        }, {
          pkgId: 3, // C
          deps: new Set([{
            pkgId: 5, // D@Y
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }, {
          pkgId: 4, // D@X
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B
          deps: new Set(),
        }, {
          pkgId: 4, // D@X
          deps: new Set(),
        }]),
      }, {
        pkgId: 3, // C
        deps: new Set(),
      }, {
        pkgId: 5, // D@Y
        deps: new Set(),
      }]),
    });
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
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
      {name: 'B'},
      {name: 'C'},
      {name: 'C'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 4, // C@X
          deps: new Set([{
            pkgId: 3, // B@Y
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set([
          2, // B@X
        ]),
      }, {
        pkgId: 2, // B@X
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 5, // C@Y
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0,
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 4,
          deps: new Set([{
            pkgId: 3,
            deps: new Set(),
          }]),
        }]),
      }, {
        pkgId: 2, // B@X
        deps: new Set(),
      }, {
        pkgId: 5, // C@Y
        deps: new Set(),
      }]),
    });
  });

  it('should honor peer dependency promise for the same version of dependency', () => {
    // . → A → B → C
    //   ⟶ B
    // Should be hoisted to (B@X must not be hoisted to the top):
    // . → A → B
    //   → C
    const packages = [
      {name: '.'},
      {name: 'A'},
      {name: 'B'},
      {name: 'C'},
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B
          deps: new Set([{
            pkgId: 3, // C
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set([
        2, // B
      ]),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B
          deps: new Set(),
        }]),
      }, {
        pkgId: 3, // C
        deps: new Set(),
      }]),
    });
  });

  it('should hoist different copies of a package independently', () => {
    // . → A → B@X → C@X
    //     → C@Y
    //   → D → B@X → C@X
    //   → B@Y
    //   → C@Z
    // Should be hoisted to (top C@X instance must not be hoisted):
    // . → A → B@X → C@X
    //     → C@Y
    //   → D → B@X
    //     → C@X
    //   → B@Y
    //   → C@Z
    const packages = [
      {name: '.'}, // .   - 0
      {name: 'A'}, // A   - 1
      {name: 'B'}, // B@X - 2
      {name: 'B'}, // B@Y - 3
      {name: 'C'}, // C@X - 4
      {name: 'C'}, // C@Y - 5
      {name: 'C'}, // C@Z - 6
      {name: 'D'}, // D   - 7
    ];
    const tree = {
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set([{
            pkgId: 4, // C@X
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }, {
          pkgId: 5, // C@Y
          deps: new Set<HoisterPackageTree>(),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 7, // D
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set([{
            pkgId: 4, // C@X
            deps: new Set<HoisterPackageTree>(),
            peerDepIds: new Set<number>(),
          }]),
          peerDepIds: new Set<number>(),
        }]),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 3, // B@Y
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }, {
        pkgId: 6, // C@Z
        deps: new Set<HoisterPackageTree>(),
        peerDepIds: new Set<number>(),
      }]),
      peerDepIds: new Set<number>(),
    };
    const result = hoist(tree, packages);
    expect(result).toEqual({
      pkgId: 0, // .
      deps: new Set([{
        pkgId: 1, // A
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set([{
            pkgId: 4, // C@X
            deps: new Set(),
          }]),
        }, {
          pkgId: 5, // C@Y
          deps: new Set(),
        }]),
      }, {
        pkgId: 7, // D
        deps: new Set([{
          pkgId: 2, // B@X
          deps: new Set(),
        }, {
          pkgId: 4, // C@X
          deps: new Set(),
        }]),
      }, {
        pkgId: 3, // B@Y
        deps: new Set(),
      }, {
        pkgId: 6, // C@Z
        deps: new Set(),
      }]),
    });
  });
});
