# use a lightweight node image
FROM node:20-alpine

# set working directory inside container
WORKDIR /app

# copy package files first — this way docker caches the npm install layer
# and only re-runs it if package.json changes, not on every code change
COPY package*.json ./

# install only production dependencies
RUN npm install --omit=dev

# copy the rest of the source code
COPY . .

# expose the port the app runs on
EXPOSE 3000

# start the server
CMD ["node", "src/server.js"]