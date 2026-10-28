// Avoid replacing text nodes or invalidating styles when a tick has no visual change.
const ViewUpdates = {
  text(node, value) {
    const text = value == null ? "" : String(value);
    if (node.textContent !== text) node.textContent = text;
  },
  hidden(node, value) {
    if (node.hidden !== !!value) node.hidden = !!value;
  },
  style(node, property, value) {
    if (node.style[property] !== value) node.style[property] = value;
  },
};
