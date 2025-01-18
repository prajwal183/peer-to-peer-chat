import Hyperswarm from "hyperswarm";
import crypto from "hypercore-crypto";
import b4a from "b4a";
import Hypercore from "hypercore";
import Hyperbee from "hyperbee";
import Corestore from "corestore";

const MESSAGE_HEADER = "CHAT:";

const { teardown } = Pear;
async function main() {
  const store = new Corestore("./data");
  await store.ready();

  const core = store.get({ name: "chat-db" });
  await core.ready();

  const swarm = new Hyperswarm();

  const db = new Hyperbee(core, {
    keyEncoding: "utf-8",
    valueEncoding: "json",
  });

  console.log("Core key:", core.key.toString("hex"));

  // Join swarm using the core key
  const discoveryKey = core.discoveryKey;
  console.log("Discovery key:", discoveryKey.toString("hex"));
  swarm.join(discoveryKey);

  teardown(() => {
    console.log("tearing down");
    swarm.destroy();
  });

  await db.ready(); // Ensure Hyperbee is ready

  // const replicationStream = db.replicate(true, { live: true });
  // console.log(replicationStream);
  // replicationStream.on("error", (err) => {
  //   console.error("Replication stream error:", err);
  // });

  // replicationStream.on("data", (chunk) => {
  //   console.log("Replication chunk received:", chunk);
  // });

  // replicationStream.on("close", () => {
  //   console.log("Replication stream closed");
  // });
  // db.on("update", () => {
  //   console.log("Hyperbee database updated");
  // });

  // core.on("append", () => {
  //   console.log("New data appended to Hypercore");
  // });

  //  const replicationStream = await db.replicate(true, { live: true });
  //  console.log(replicationStream)
  //   // Set up replication stream
  console.log(`Hypercore key: ${core.key.toString("hex")}`);

  // listen for incoming connections
  swarm.on("connection", (peer) => {
    console.log(`${peer.remotePublicKey.toString("hex")} connected`);
    const name = b4a.toString(peer.remotePublicKey, "hex").substring(0, 6);
    console.log(`Hypercore key: ${core.key.toString("hex")}`);
    console.log(`${name} connected`);
    store.replicate(peer);
    // const replicationStream = store.replicate(peer, { live: true });
    // peer.pipe(replicationStream);

    peer.on("data", (data) => {
      let message = b4a.toString(data, "utf-8");
      if (message.startsWith(MESSAGE_HEADER)) {
        console.log(`${name} sent: ${message}`);
        const actualMessage = message.slice(MESSAGE_HEADER.length); // Remove header

        onMessageSent(name, actualMessage);
      } else {
        console.log(`${name} sent noise data or empty message.`);
      }
    });
    peer.on("end", () => {
      console.log(`${name} disconnected`);
    });
    peer.on("error", (err) => {
      console.log(`${name} error: ${err}`);
    });
  });

  // listen for peer updates
  swarm.on("update", () => {
    document.querySelector("#peers-count").textContent = swarm.connections.size;
    console.log(`${swarm.connections.size} peers connected`);
  });

  async function saveMessage(from, message) {
    const timestamp = Date.now().toString(); // Use timestamp as key
    await db.put(timestamp, { from, message });
    console.log(`Message saved: ${from}: ${message}`);
  }

  // Function to fetch messages from the database
  async function loadMessages() {
    const messages = [];
    for await (const { key, value } of db.createReadStream()) {
      messages.push({ timestamp: key, ...value });
    }
    return messages;
  }

  // Load and display previous messages on app startup
  async function displayPreviousMessages() {
    const messages = await loadMessages();
    console.log(messages);
    messages.forEach(({ from, message }) => onMessageSent(from, message));
  }

  // Call this function after setting up the app UI
  await displayPreviousMessages();

  document
    .querySelector("#create-chat-room")
    .addEventListener("click", createChatRoom);
  document.querySelector("#join-form").addEventListener("submit", joinChatRoom);

  async function createChatRoom() {
    const topicBuffer = crypto.randomBytes(32);
    console.log(`topic: ${b4a.toString(topicBuffer, "hex")}`);
    joinSwarm(topicBuffer);
  }

  async function joinChatRoom(event) {
    event.preventDefault();
    const topicStr = document.querySelector("#join-chat-room-topic").value;
    console.log(`topic: ${topicStr}`);
    const topicBuffer = b4a.from(topicStr, "hex");
    joinSwarm(topicBuffer);
  }

  async function joinSwarm(topicBuffer) {
    document.querySelector("#setup").classList.add("hidden");
    document.querySelector("#loading").classList.remove("hidden");

    const discovery = swarm.join(topicBuffer, {
      client: true,
      server: true,
    });
    await discovery.flushed();
    const topic = b4a.toString(topicBuffer, "hex");
    document.querySelector("#chat-room-topic").innerText = topic;
    document.querySelector("#loading").classList.add("hidden");
    document.querySelector("#chat").classList.remove("hidden");
    document.querySelector("#setup").classList.add("hidden");
  }

  document
    .querySelector("#message-form")
    .addEventListener("submit", sendMessage);

  async function sendMessage(e) {
    const message = document.querySelector("#message").value;
    e.preventDefault();
    onMessageSent("Peer1", MESSAGE_HEADER + message);
    await saveMessage("Peer1", message);
    // Send the message to all peers (that you are connected to)
    const peers = [...swarm.connections];
    for (const peer of peers)
      peer.write(Buffer.from(MESSAGE_HEADER + message, "utf-8"));
  }

  async function onMessageSent(from, message) {
    const $div = document.createElement("div");
    $div.innerHTML = `<p><strong>${from}:</strong> ${message}</p>`;
    document.querySelector("#messages").appendChild($div);
  }
}

main();
