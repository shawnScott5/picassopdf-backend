# AWS Lambda Node.js 20 base image
FROM public.ecr.aws/lambda/nodejs:20

WORKDIR /var/task

# Install required system libraries for headless Chrome
RUN microdnf install -y \
    nss \
    nspr \
    dbus-libs \
    atk \
    at-spi2-atk \
    expat \
    gtk3 \
    pango \
    alsa-lib \
    libX11 \
    libXcomposite \
    libXdamage \
    libXext \
    libXfixes \
    libXrandr \
    libXcursor \
    libxcb \
    libxkbcommon \
    mesa-libgbm \
    libdrm \
    systemd-libs \
    cups-libs \
    && microdnf clean all

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --omit=dev

# Copy Lambda code
COPY index.js ./

# Lambda handler
CMD ["index.handler"]