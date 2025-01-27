import { io } from "socket.io-client";

const URL = "https://webrtcs.onrender.com";
// const URL = "https://video-call-server-gm7i.onrender.com";

export const socket = io(URL);
export const navbarBrand = "Doctor Patient Video Setup";
