const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const PORT = 3001;

// Melayani file statis dari folder "public"
app.use(express.static("public"));

// Map untuk melacak pengguna di dalam room
const rooms = {};

// Event saat ada koneksi baru
io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Bergabung ke "room1"
    socket.join("room1");
    if (!rooms["room1"]) rooms["room1"] = new Set();
    rooms["room1"].add(socket.id);

    // Kirim daftar pengguna lain di room kepada pengguna yang baru masuk
    const joinedUsers = Array.from(rooms["room1"]).filter((id) => id !== socket.id);
    if (joinedUsers.length > 0) {
        socket.emit("ada user lain", joinedUsers);
    }

    // Notifikasi ke pengguna lain bahwa pengguna baru telah bergabung
    socket.broadcast.to("room1").emit("ada user lain", [socket.id]);

    // Event: Meneruskan "offer" ke pengguna target
    socket.on("offer", ({ offer, to: targetId, from }) => {
        io.to(targetId).emit("offer", { offer, from });
    });

    // Event: Meneruskan "answer" ke pengguna target
    socket.on("answer", ({ answer, to: targetId, from }) => {
        io.to(targetId).emit("answer", { answer, from });
    });

    // Event: Meneruskan ICE candidate ke pengguna target
    socket.on("ice candidate", ({ iceCandidate, to: targetId, from }) => {
        io.to(targetId).emit("ice candidate", iceCandidate);
    });

    // Event: Menerima pesan chat dan meneruskannya ke pengguna target
    socket.on("chatMessage", ({ message, from, to: targetId }) => {
        io.to(targetId).emit("chatMessage", { message, from });
    });

    // Event: Saat pengguna disconnect
    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        rooms["room1"].delete(socket.id);

        // Notifikasi ke pengguna lain di room bahwa pengguna telah keluar
        socket.broadcast.to("room1").emit("ada user lain", Array.from(rooms["room1"]));
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
