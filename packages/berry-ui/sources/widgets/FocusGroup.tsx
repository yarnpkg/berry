import React = require('react');

type FocusEntryProps = {
  focusGroup: FocusGroup,
  column: number,
  row: number,
  children: JSX.Element,
};

type FocusEntryPublicProps = {
  column: number,
  row: number,
  children: JSX.Element,
};

class FocusEntry extends React.PureComponent<FocusEntryProps, any> {
  ref = React.createRef();

  previousColumn: number = NaN;
  previousRow: number = NaN;

  triggerFocus() {
    if (!this.ref.current)
      throw new Error(`Assertion failed: We should be able to focus this element`);
    
    // @ts-ignore
    this.ref.current.triggerFocus();
  }

  componentDidMount() {
    this.props.focusGroup.attachEntry(this.props.column, this.props.row, this);

    this.previousColumn = this.props.column;
    this.previousRow = this.props.row;
  }

  componentDidUpdate() {
    if (this.previousColumn !== this.props.column || this.previousRow !== this.props.row) {
      this.props.focusGroup.detachEntry(this.previousColumn, this.previousRow, this);
      this.props.focusGroup.attachEntry(this.props.column, this.props.row, this);

      this.previousColumn = this.props.column;
      this.previousRow = this.props.row;
    }
  }

  componentWillUnmount() {
    this.props.focusGroup.detachEntry(this.props.column, this.props.row, this);
  }

  handleFocus = (e: any) => {
    this.props.focusGroup.setSelection(this.props.column, this.props.row);

    if (this.props.children.props.onFocus) {
      this.props.children.props.onFocus(e);
    }
  };

  handleBlur = (e: any) => {
    this.props.focusGroup.clearSelection();

    if (this.props.children.props.onBlur) {
      this.props.children.props.onBlur(e);
    }
  };

  shortcuts = {
    left: () => {
      this.props.focusGroup.moveLeft();
    },
    right: () => {
      this.props.focusGroup.moveRight();
    },
    up: () => {
      this.props.focusGroup.moveUp();
    },
    down: () => {
      this.props.focusGroup.moveDown();
    },
  };

  render = () => React.cloneElement(this.props.children, {
    // Keep a reference to the children so that we can focus it later on
    ref: this.ref,
    
    // Makes the element focusable
    tabIndex: 0,

    // Catch the focus events
    onFocus: this.handleFocus,
    onBlur: this.handleBlur,

    // Catch the arrow keys
    shortcuts: {... this.shortcuts, ... this.props.children.props.shortcuts}
  });
};

type FocusGroupProps = {
  children: (FocusEntry: (props: FocusEntryPublicProps) => JSX.Element) => any,
};

export class FocusGroup extends React.PureComponent<FocusGroupProps, any> {
  private position: {column: number, row: number} | null = null;
  private board: Array<Array<Array<FocusEntry> | null>> = [];

  attachEntry(column: number, row: number, entry: FocusEntry) {
    this.board[row] = this.board[row] || [];
    this.board[row][column] = this.board[row][column] || [];
    
    const cell = this.board[row][column];

    if (!cell)
      throw new Error(`Assertion failed: The cell should have existed`);

    cell.push(entry);
  }

  detachEntry(column: number, row: number, entry: FocusEntry) {
    const cell = this.board[row][column];

    if (!cell)
      throw new Error(`Assertion failed: The cell should have existed`);

    const index = cell.indexOf(entry);

    if (index === -1)
      throw new Error(`Assertion failed: The entry should have been found`);

    if (cell.length === 1) {
      this.board[row][column] = null;
    } else {
      cell.splice(index, 1);
    }
  }

  setSelection(column: number, row: number) {
    if (this.position)
      throw new Error(`Assertion failed: The position shouldn't already exist`);
    
    this.position = {column, row};
  }

  clearSelection() {
    if (!this.position)
      throw new Error(`Assertion failed: The position should have existed`);
    
    this.position = null;
  }

  moveLeft() {
    if (!this.position)
      throw new Error(`Assertion failed: The position should have existed`);
    
    let {column, row} = this.position;

    if (!this.board[row])
      throw new Error(`Assertion failed: the row should have existed`);
    if (!this.board[row][column])
      throw new Error(`Assertion failed: the column should have existed`);
    
    const length = this.board[row].length;

    do {
      column = (length + column - 1) % length;
    } while (!this.board[row][column]);

    const cell = this.board[row][column];

    if (!cell)
      throw new Error(`Assertion failed: The cell should have existed`);
    if (!cell[0])
      throw new Error(`Assertion failed: The cell shouldn't be empty`);

    cell[0].triggerFocus();
  }

  moveRight() {
    if (!this.position)
      throw new Error(`Assertion failed: The position should have existed`);
    
    let {column, row} = this.position;

    if (!this.board[row])
      throw new Error(`Assertion failed: the row should have existed`);
    if (!this.board[row][column])
      throw new Error(`Assertion failed: the column should have existed`);
    
    const length = this.board[row].length;
    
    do {
      column = (column + 1) % length;
    } while (!this.board[row][column]);

    const cell = this.board[row][column];

    if (!cell)
      throw new Error(`Assertion failed: The cell should have existed`);
    if (!cell[0])
      throw new Error(`Assertion failed: The cell shouldn't be empty`);

    cell[0].triggerFocus();
  }

  moveUp() {
    if (!this.position)
      throw new Error(`Assertion failed: The position should have existed`);
    
    let {column, row} = this.position;

    if (!this.board[row])
      throw new Error(`Assertion failed: the row should have existed`);
    if (!this.board[row][column])
      throw new Error(`Assertion failed: the column should have existed`);
    
    const length = this.board.length;

    do {
      row = (length + row - 1) % length;
    } while (!this.board[row][column]);

    const cell = this.board[row][column];

    if (!cell)
      throw new Error(`Assertion failed: The cell should have existed`);
    if (!cell[0])
      throw new Error(`Assertion failed: The cell shouldn't be empty`);

    cell[0].triggerFocus();
  }

  moveDown() {
    if (!this.position)
      throw new Error(`Assertion failed: The position should have existed`);
    
    let {column, row} = this.position;

    if (!this.board[row])
      throw new Error(`Assertion failed: the row should have existed`);
    if (!this.board[row][column])
      throw new Error(`Assertion failed: the column should have existed`);
    
    const length = this.board.length;

    do {
      row = (row + 1) % length;
    } while (!this.board[row][column]);

    const cell = this.board[row][column];

    if (!cell)
      throw new Error(`Assertion failed: The cell should have existed`);
    if (!cell[0])
      throw new Error(`Assertion failed: The cell shouldn't be empty`);

    cell[0].triggerFocus();
  }

  renderFocusEntry = (props: FocusEntryPublicProps): JSX.Element => {
    return <FocusEntry focusGroup={this} {... props} />;
  };

  render = () => this.props.children(this.renderFocusEntry);
};
