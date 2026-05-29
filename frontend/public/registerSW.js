self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

try {
  importScripts('/sw.js');
} catch (error) {
  self.addEventListener('activate', function(event) {
    event.waitUntil((async function() {
      try {
        var keys = await caches.keys();
        await Promise.all(keys.map(function(key) {
          return caches.delete(key);
        }));
      } catch (cacheError) {}

      try {
        await self.registration.unregister();
      } catch (unregisterError) {}

      var clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map(function(client) {
        return client.navigate(client.url);
      }));
    })());
  });
}