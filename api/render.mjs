import application from '../dist/server/index.js';

const renderer = {
  async fetch(request) {
    return application.fetch(request, {}, {
      waitUntil(promise) {
        promise.catch(() => undefined);
      },
      hostRuntime: 'node',
    });
  },
};

export default renderer;
