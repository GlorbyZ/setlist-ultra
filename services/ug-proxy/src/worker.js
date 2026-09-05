import { handleUgRequest } from './ug.js';

export default {
  async fetch(request) {
    return handleUgRequest(request);
  },
};
