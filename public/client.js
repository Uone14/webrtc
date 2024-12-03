const userVideo = document.querySelector(".user-video video");
const remoteVideo = document.querySelector(".remote-video video");

let peer;
let remoteId;

const socket = io();

// Event saat ada pengguna lain yang bergabung
socket.on("ada user lain", async (joinedUsers) => {
    remoteId = joinedUsers.find((userId) => userId !== socket.id);
    if (remoteId) await createPeerConnection();
});

// Menerima "offer" dari pengguna lain
socket.on("offer", async ({ offer, from }) => {
    remoteId = from;
    if (!peer) await createPeerConnection();
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(new RTCSessionDescription(answer));
    socket.emit("answer", { answer, to: remoteId, from: socket.id });
});

// Menangani ice candidate
socket.on("ice candidate", async (iceCandidate) => {
    if (peer) {
        try {
            const candidate = new RTCIceCandidate(iceCandidate);
            await peer.addIceCandidate(candidate);
        } catch (error) {
            console.warn("Failed to add ICE candidate", error);
        }
    }
});

// Menerima "answer" dari pengguna lain
socket.on("answer", async ({ answer }) => {
    if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

// Membuat koneksi peer
async function createPeerConnection() {
    peer = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.stunprotocol.org" },
            {
                urls: "turn:numb.viagenie.ca",
                username: "webrtc@live.com",
                credential: "muazkh",
            },
        ],
    });

    // Mendapatkan stream video/audio dari pengguna lokal
    const userStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
    });
    userVideo.muted = true;
    userVideo.srcObject = userStream;
    userVideo.onloadmetadata = () => {
        userVideo.play();
    };

    // Menambahkan stream ke peer connection
    userStream.getTracks().forEach((track) => peer.addTrack(track, userStream));

    peer.onicecandidate = handleIceCandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = handleNegotiationNeededEvent;
}

// Negosiasi saat diperlukan
async function handleNegotiationNeededEvent() {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(new RTCSessionDescription(offer));
    socket.emit("offer", { offer, to: remoteId, from: socket.id });
}

// Menangani track event (stream remote)
function handleTrackEvent(e) {
    const [stream] = e.streams;
    remoteVideo.srcObject = stream;
    remoteVideo.onloadmetadata = () => {
        remoteVideo.play();
    };
}

// Menangani event ICE candidate
function handleIceCandidateEvent(e) {
    if (e.candidate) {
        socket.emit("ice candidate", { iceCandidate: e.candidate, to: remoteId });
    }
}

// === Fitur Chat ===
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Kirim pesan saat form dikirim
chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (message) {
        socket.emit("chatMessage", { message, from: socket.id, to: remoteId });
        addMessageToChat("You", message); // Tambahkan pesan lokal
        chatInput.value = ""; // Kosongkan input
    }
});

// Tambahkan pesan baru ke UI
function addMessageToChat(user, message) {
    const li = document.createElement("li");
    li.textContent = `${user}: ${message}`;
    chatMessages.appendChild(li);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll otomatis ke bawah
}

// Menerima pesan dari pengguna lain
socket.on("chatMessage", ({ message, from }) => {
    const sender = from === remoteId ? "User B" : "Unknown";
    addMessageToChat(sender, message);
});
