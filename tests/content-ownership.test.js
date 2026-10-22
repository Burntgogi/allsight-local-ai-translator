const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../src/content-core.js");

function runtime(nodes = []) {
  const source = fs.readFileSync(path.join(__dirname, "../src/content.js"), "utf8");
  const end = "})(globalThis);";
  assert.equal(source.split(end).length, 2);
  const context = {
    AiPageTranslatorCore: core,
    NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
    document: {
      documentElement: { clientWidth: 800, clientHeight: 600 },
      createTreeWalker(root, mask, filter) {
        let index = 0;
        return { currentNode: null, nextNode() {
          while (index < nodes.length) {
            const node = nodes[index++];
            if (filter.acceptNode(node) === 1) {
              this.currentNode = node;
              return true;
            }
          }
          return false;
        } };
      }
    },
    chrome: { runtime: { onMessage: { addListener() {} } } }
  };
  // Expose closure state only in this isolated test realm; production source is unchanged.
  vm.runInNewContext(source.replace(end,
    "globalScope.testRuntime = { state, collectTextItems, applyTranslations, restorePage };\n" + end), context);
  return context.testRuntime;
}

function original(api, text = "Order pending", connected = true) {
  const node = { nodeValue: text, isConnected: connected };
  api.state.originals.set("t1", { node, text });
  return node;
}

function apply(api, text = "주문 대기 중") {
  return api.applyTranslations([{ id: "t1" }], new Map([["t1", text]]));
}

test("a delayed translation preserves a newer page value", () => {
  const api = runtime();
  const node = original(api);
  node.nodeValue = "Order delivered";
  assert.equal(apply(api).count, 0);
  assert.equal(node.nodeValue, "Order delivered");
});

test("restore preserves a page update made after translation", () => {
  const api = runtime();
  const node = original(api);
  assert.equal(apply(api).count, 1);
  node.nodeValue = "Order cancelled";
  api.restorePage({ silent: true, skipCancel: true });
  assert.equal(node.nodeValue, "Order cancelled");
  assert.equal(api.state.originals.size, 0);
});

test("restore preserves updated nodes that never received a translation", () => {
  const api = runtime();
  const node = original(api);
  node.nodeValue = "New page text";
  api.restorePage({ silent: true, skipCancel: true });
  assert.equal(node.nodeValue, "New page text");
});

test("unchanged translated nodes restore their exact original whitespace", () => {
  const api = runtime();
  const node = original(api, "  Order pending\n");
  assert.equal(apply(api).count, 1);
  assert.equal(node.nodeValue, "  주문 대기 중\n");
  api.restorePage({ silent: true, skipCancel: true });
  assert.equal(node.nodeValue, "  Order pending\n");
});

test("a second stale result cannot replace an already applied translation", () => {
  const api = runtime();
  const node = original(api);
  assert.equal(apply(api).count, 1);
  assert.equal(apply(api, "늦은 응답").count, 0);
  assert.equal(node.nodeValue, "주문 대기 중");
});

test("disconnected nodes are neither translated nor restored", () => {
  const api = runtime();
  const node = original(api, "Old text", false);
  assert.equal(apply(api).count, 0);
  node.nodeValue = "Detached text";
  api.restorePage({ silent: true, skipCancel: true });
  assert.equal(node.nodeValue, "Detached text");
});

function pageNode(text = "Order pending") {
  return { nodeValue: text, isConnected: true, parentElement: {
    tagName: "P", isConnected: true, nodeType: 1, parentElement: null, closest: () => null
  } };
}

function collect(api) {
  return api.collectTextItems({}, { viewportOnly: false, excludeTranslatedNodes: true }).items;
}

function reply(api, items, translation) {
  return api.applyTranslations(items, new Map([[items[0].id, translation]]));
}

test("a rescan translates updated page text and invalidates the old response", () => {
  const node = pageNode();
  const api = runtime([node]);
  const initial = collect(api);
  node.nodeValue = "  Order delivered\n";
  const fresh = collect(api);
  assert.equal(fresh[0].text, "Order delivered");
  assert.equal(reply(api, initial, "주문 대기 중").count, 0);
  assert.equal(reply(api, fresh, "주문 배송 완료").count, 1);
  api.restorePage({ silent: true, skipCancel: true });
  assert.equal(node.nodeValue, "  Order delivered\n");
});

test("a page update of an already translated node can be translated by a rescan", () => {
  const node = pageNode();
  const api = runtime([node]);
  assert.equal(reply(api, collect(api), "주문 대기 중").count, 1);
  assert.equal(collect(api).length, 0);
  node.nodeValue = "Order delivered";
  const fresh = collect(api);
  assert.equal(fresh.length, 1);
  assert.equal(reply(api, fresh, "주문 배송 완료").count, 1);
  api.restorePage({ silent: true, skipCancel: true });
  assert.equal(node.nodeValue, "Order delivered");
});

test("an earlier request stays invalid when the page cycles back to the same text", () => {
  const node = pageNode();
  const api = runtime([node]);
  const first = collect(api);
  node.nodeValue = "Order delivered";
  collect(api);
  node.nodeValue = "Order pending";
  const latest = collect(api);
  assert.equal(reply(api, first, "Old response").count, 0);
  assert.equal(reply(api, latest, "Current response").count, 1);
});
