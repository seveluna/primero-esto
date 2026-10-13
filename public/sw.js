self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: "Primero esto", body: event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Primero esto", {
    body: data.body || "Tienes alimentos próximos a su fecha.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "primero-esto",
    data: { url: "/" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    return existing ? existing.focus() : self.clients.openWindow("/");
  }));
});
