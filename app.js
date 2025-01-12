import Hyperswarm from "hyperswarm";
import crypto from "hypercore-crypto";
import b4a from "b4a";
const { teardown } = Pear;

const swarm = new Hyperswarm();

teardown(() => {
  console.log("tearing down");
  swarm.destroy();
});

// listen for incoming connections
swarm.on("connection", (peer) => {
  console.log(`${peer.remotePublicKey.toString("hex")} connected`);
  const name = b4a.toString(peer.remotePublicKey, "hex").substring(0, 6);
  console.log(`${name} connected`);
  peer.on("data", (data) => {
    console.log(`${name} sent: ${data}`);
    onMessageSent(name, data);
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

document.querySelector("#message-form").addEventListener("submit", sendMessage);

async function sendMessage(e) {
  const message = document.querySelector("#message").value;
  e.preventDefault();
  onMessageSent('You', message)
  // Send the message to all peers (that you are connected to)
  const peers = [...swarm.connections]
  for (const peer of peers) peer.write(message)
  
}

async function onMessageSent(from, message) {
  const $div = document.createElement("div");
  $div.innerHTML = `<p><strong>${from}:</strong> ${message}</p>`;
  document.querySelector("#messages").appendChild($div);
}
