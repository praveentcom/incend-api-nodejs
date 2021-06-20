sudo pm2 kill
cd /var/www/ipaasincendin
git pullsudo rm -rf node_modules package-lock.json
sudo npm install
sudo npm run build
cd src
sudo pm2 start index.js