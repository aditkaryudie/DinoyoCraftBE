"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pusher = void 0;
const pusher_1 = __importDefault(require("pusher"));
exports.pusher = new pusher_1.default({
    appId: (process.env.PUSHER_APP_ID || '').trim(),
    key: (process.env.PUSHER_KEY || '').trim(),
    secret: (process.env.PUSHER_SECRET || '').trim(),
    cluster: (process.env.PUSHER_CLUSTER || 'ap1').trim(),
    useTLS: true,
});
exports.default = exports.pusher;
//# sourceMappingURL=pusher.js.map