import libzip from './libzip.node';
import { buildApi } from './buildLibZipApi';

// eslint-disable-next-line arca/no-default-export
export default buildApi(libzip);
