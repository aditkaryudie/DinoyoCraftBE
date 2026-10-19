import { JwtPayload } from 'jsonwebtoken';

declare global {
    namespace Express {
        interface Request {
            user?: string | JwtPayload | any; // Sesuaikan 'any' dengan tipe data payload JWT kamu jika sudah ada
        }
    }
}