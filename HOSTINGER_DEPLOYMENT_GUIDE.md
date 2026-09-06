# Hostinger Deployment Guide — Medical Store Web App

Aapka ready-to-deploy zip bundle tayyar ho chuka hai:
📁 **File Path**: `backend-deploy.zip` (Project root directory mein maujood hai — Size: ~587 KB)

Is zip file ke andar:
- ✅ **Complete Backend API** (Express, Prisma, Auth, Invoicing, Purchasing, Cash Book, Bank Accounts & Bank Ledger)
- ✅ **Complete Production React Frontend** (`public/` folder ke andar build kiya gaya hai)
- ✅ **Prisma Database Schema & Migrations** (`prisma/schema.prisma`)
- ✅ **PM2 Configuration** (`ecosystem.config.js`)
- ✅ **Production Environment Template** (`.env.example`)

---

## Method 1: Hostinger Web / Cloud Hosting (hPanel Node.js App Manager)

Agar aap Hostinger ki **Web Hosting** ya **Cloud Hosting** use kar rahe hain jismein **Node.js** ka option hota hai:

### Step 1: Node.js Application Create Karein
1. **Hostinger hPanel** mein login karein (`hpanel.hostinger.com`).
2. Left menu mein **Advanced** ya **Websites** section mein jayein aur **Node.js** par click karein.
3. **Create Application** par click karein:
   - **Node.js version**: `18.x` ya `20.x` select karein.
   - **Application root**: Apna domain folder select karein (e.g. `public_html` ya `medical-app`).
   - **Application startup file**: `src/server.js` likhein.
4. **Create** par click karein.

---

### Step 2: ZIP File Upload Aur Extract Karein
1. hPanel mein **File Manager** open karein.
2. Apne application root folder (jahan app banayi hai, e.g. `public_html`) mein jayein.
3. Agar wahan koi default `index.html` ya dummy files hain toh unhe delete kar dein.
4. **Upload** button par click karein aur `backend-deploy.zip` select karein.
5. Upload complete hone ke baad, `backend-deploy.zip` par right click karein aur **Extract** par click karein.
   - Files directly usi folder mein extract honi chahiyein taake `src`, `public`, `prisma`, `package.json` root level par hon.
6. Extract hone ke baad `backend-deploy.zip` ko delete kar sakte hain.

---

### Step 3: Environment Variables (.env) Set Karein
Hostinger Node.js manager mein **Environment Variables** ka tab hota hai, ya File Manager mein ek `.env` file create karein:

```env
# Database (Neon Cloud PostgreSQL)
DATABASE_URL="postgresql://neondb_owner:npg_HYKp0jWTLE6n@ep-noisy-shadow-aex4es0t.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DATABASE_URL_POOLED="postgresql://neondb_owner:npg_HYKp0jWTLE6n@ep-noisy-shadow-aex4es0t-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# JWT Secrets
JWT_SECRET="8f3a2e1d9c7b4f6e0a5d8c2b1f4e7a9d3c6b0e5f8a2d4c7b1e3f6a9d2c5b8e1f4a7d0c3b6e9f2a5d8c1b4e7f0a3d6"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="a1b4e7d0c3f6a9b2e5d8c1f4b7e0a3d6c9f2a5b8e1d4c7f0a3b6e9d2c5f8b1e4a7d0c3b6f9a2e5d8c1b4f7e0a3d6c9"
JWT_REFRESH_EXPIRES_IN="30d"

# Server
PORT=3000
NODE_ENV=production
```

---

### Step 4: Dependencies Install Karein (NPM Install)
1. Hostinger Node.js page par **NPM Install** button par click karein.
2. Ya hPanel ke **SSH / Terminal** ya Web Terminal mein ja kar yeh commands run karein:
   ```bash
   npm install --omit=dev
   npx prisma generate
   npx prisma db push
   ```

---

### Step 5: Application Start / Restart Karein
1. Hostinger Node.js panel mein **Restart Application** button par click karein.
2. Apne domain par visit karein (e.g. `https://yourdomain.com`).
3. App live chal rahi hogi!

---

## Method 2: Hostinger VPS (Ubuntu / Linux with SSH)

Agar aapke paas **Hostinger VPS** hai:

1. **ZIP File VPS par upload karein (via SCP ya FileZilla / Cyberduck)**:
   ```bash
   scp "backend-deploy.zip" root@YOUR_SERVER_IP:/var/www/medical-store/
   ```

2. **SSH login karein**:
   ```bash
   ssh root@YOUR_SERVER_IP
   cd /var/www/medical-store
   unzip backend-deploy.zip
   ```

3. **Node.js, PM2 aur Dependencies install karein**:
   ```bash
   npm install --omit=dev
   npx prisma generate
   npx prisma db push
   ```

4. **PM2 ke zariye app start karein**:
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

5. **Nginx Reverse Proxy (agar Nginx use kar rahe hain)**:
   ```nginx
   server {
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## Login Credentials (Default Seed Data)
- **Email**: `demo@medicalstore.app`
- **Password**: `Demo@12345`
*(Aap app mein naya account bhi signup kar sakte hain)*
