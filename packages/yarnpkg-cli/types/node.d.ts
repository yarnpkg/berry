declare namespace NodeJS {
  interface ReadStream {
    readonly readableObjectMode: boolean;
    destroyed: boolean;
  }
  interface WriteStream {
    readonly writableObjectMode: boolean;
    destroyed: boolean;
  }
}
