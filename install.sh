#!/bin/bash

# ==============================================================================
# WeBot TypeScript - Installation & Management Script
# ==============================================================================
# Version: 1.0.0
# Description: Complete installation, update, and backup script for WeBot
# ==============================================================================

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR]${NC} Please run this script as ${YELLOW}root${NC}"
    echo "Usage: sudo bash install.sh"
    exit 1
fi

# ==============================================================================
# FUNCTIONS
# ==============================================================================

# Display logo
show_logo() {
    clear
    echo -e "${BLUE}"
    echo "================================================================================"
    echo "  __  __ _____ _____   ______           ____   ____ _______   _______ _____ "
    echo " |  \\/  |_   _|  __ \\ |___  /    /\\    |  _ \\ / __ \\__   __| |__   __/ ____|"
    echo " | \\  / | | | | |__) |   / /    /  \\   | |_) | |  | | | |       | | | (___  "
    echo " | |\\/| | | | |  _  /   / /    / /\\ \\  |  _ <| |  | | | |       | |  \\___ \\ "
    echo " | |  | |_| |_| | \\ \\  / /__  / ____ \\ | |_) | |__| | | |       | |  ____) |"
    echo " |_|  |_|_____|_|  \\_\\/_____/_/    \\_\\|____/ \\____/  |_|       |_| |_____/ "
    echo "================================================================================"
    echo -e "${NC}"
    echo ""
    echo -e "${CYAN}Version:${NC} ${YELLOW}1.0.0 (TypeScript)${NC}"
    echo -e "${CYAN}Telegram Channel:${NC} ${BLUE}https://t.me/mirzapanel${NC}"
    echo -e "${CYAN}GitHub:${NC} ${BLUE}https://github.com/yourusername/WeBot-typescript${NC}"
    echo ""
}

# Check bot installation status
check_bot_status() {
    if [ -f "/opt/WeBot/.env" ]; then
        echo -e "${GREEN}✅ Bot is installed${NC}"
        
        # Check if bot is running with PM2
        if command -v pm2 &> /dev/null; then
            if pm2 status WeBot &> /dev/null; then
                echo -e "${GREEN}✅ Bot is running (PM2)${NC}"
            else
                echo -e "${YELLOW}⚠  Bot is not running${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ Bot is not installed${NC}"
    fi
}

# Display main menu
show_menu() {
    show_logo
    echo -e "${CYAN}Installation Status:${NC}"
    check_bot_status
    echo ""
    echo -e "${CYAN}1)${NC} Install WeBot TypeScript"
    echo -e "${CYAN}2)${NC} Update WeBot"
    echo -e "${CYAN}3)${NC} Restart Bot"
    echo -e "${CYAN}4)${NC} Stop Bot"
    echo -e "${CYAN}5)${NC} View Logs"
    echo -e "${CYAN}6)${NC} Backup Database"
    echo -e "${CYAN}7)${NC} Restore Database"
    echo -e "${CYAN}8)${NC} Uninstall Bot"
    echo -e "${CYAN}9)${NC} Exit"
    echo ""
    read -p "Select an option [1-9]: " option
    
    case $option in
        1) install_bot ;;
        2) update_bot ;;
        3) restart_bot ;;
        4) stop_bot ;;
        5) view_logs ;;
        6) backup_database ;;
        7) restore_database ;;
        8) uninstall_bot ;;
        9) exit 0 ;;
        *) 
            echo -e "${RED}Invalid option${NC}"
            sleep 2
            show_menu
            ;;
    esac
}

# Install Node.js
install_nodejs() {
    echo -e "${YELLOW}Installing Node.js 20.x...${NC}"
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    
    # Install Node.js
    apt-get install -y nodejs
    
    # Verify installation
    if node --version &> /dev/null; then
        echo -e "${GREEN}✅ Node.js installed: $(node --version)${NC}"
    else
        echo -e "${RED}❌ Node.js installation failed${NC}"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    echo -e "${YELLOW}Installing system dependencies...${NC}"
    
    apt-get update
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        build-essential \
        mysql-server \
        redis-server
    
    # Enable and start services
    systemctl enable mysql
    systemctl start mysql
    systemctl enable redis-server
    systemctl start redis-server
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Install PM2
install_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}Installing PM2...${NC}"
        npm install -g pm2
        pm2 startup systemd -u root --hp /root
        echo -e "${GREEN}✅ PM2 installed${NC}"
    else
        echo -e "${GREEN}✅ PM2 already installed${NC}"
    fi
}

# Main installation function
install_bot() {
    clear
    echo -e "${GREEN}=== WeBot TypeScript Installation ===${NC}\n"
    
    # Check if already installed
    if [ -f "/opt/WeBot/.env" ]; then
        echo -e "${YELLOW}Bot is already installed!${NC}"
        read -p "Do you want to reinstall? (y/n): " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            show_menu
            return
        fi
    fi
    
    # Install dependencies
    install_nodejs
    install_dependencies
    install_pm2
    
    # Create installation directory
    echo -e "${YELLOW}Creating installation directory...${NC}"
    mkdir -p /opt/WeBot
    cd /opt/WeBot
    
    # Download source code
    echo -e "${YELLOW}Downloading WeBot...${NC}"
    
    # Option 1: From GitHub release
    REPO="yourusername/WeBot-typescript"
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$LATEST_RELEASE" ]; then
        # Fallback: Clone from main branch
        echo -e "${YELLOW}Using main branch...${NC}"
        git clone https://github.com/$REPO.git .
    else
        # Download release
        wget "https://github.com/$REPO/archive/refs/tags/$LATEST_RELEASE.tar.gz"
        tar -xzf "$LATEST_RELEASE.tar.gz" --strip-components=1
        rm "$LATEST_RELEASE.tar.gz"
    fi
    
    # Install Node packages
    echo -e "${YELLOW}Installing Node.js packages...${NC}"
    npm install --production=false
    
    # Setup MySQL database
    echo -e "${YELLOW}\n=== Database Configuration ===${NC}"
    read -p "Enter MySQL root password (leave blank if no password): " MYSQL_ROOT_PASS
    
    # Create database
    DB_NAME="WeBot"
    DB_USER="WeBot_user"
    DB_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9')
    
    echo -e "${YELLOW}Creating database...${NC}"
    
    if [ -z "$MYSQL_ROOT_PASS" ]; then
        mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
        mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
        mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;"
    else
        mysql -p"$MYSQL_ROOT_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
        mysql -p"$MYSQL_ROOT_PASS" -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
        mysql -p"$MYSQL_ROOT_PASS" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;"
    fi
    
    # Get bot configuration
    echo -e "${YELLOW}\n=== Bot Configuration ===${NC}"
    read -p "Enter Bot Token: " BOT_TOKEN
    while [[ ! "$BOT_TOKEN" =~ ^[0-9]{8,10}:[a-zA-Z0-9_-]{35}$ ]]; do
        echo -e "${RED}Invalid token format${NC}"
        read -p "Enter Bot Token: " BOT_TOKEN
    done
    
    read -p "Enter Admin Chat ID: " ADMIN_CHAT_ID
    while [[ ! "$ADMIN_CHAT_ID" =~ ^-?[0-9]+$ ]]; do
        echo -e "${RED}Invalid Chat ID${NC}"
        read -p "Enter Admin Chat ID: " ADMIN_CHAT_ID
    done
    
    # Create .env file
    echo -e "${YELLOW}Creating configuration file...${NC}"
    cat > .env <<EOF
# Bot Configuration
BOT_TOKEN=$BOT_TOKEN
ADMIN_CHAT_ID=$ADMIN_CHAT_ID
NODE_ENV=production

# Database
DATABASE_URL="mysql://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Logging
LOG_LEVEL=info
EOF
    
    # Run Prisma migrations
    echo -e "${YELLOW}Setting up database schema...${NC}"
    npx prisma generate
    npx prisma migrate deploy
    
    # Build TypeScript 
    echo -e "${YELLOW}Building application...${NC}"
    npm run build
    
    # Start with PM2
    echo -e "${YELLOW}Starting bot with PM2...${NC}"
    pm2 start npm --name "WeBot" -- start
    pm2 save
    
    # Save credentials
    mkdir -p /root/WeBot-config
    cat > /root/WeBot-config/credentials.txt <<EOF
Database Name: $DB_NAME
Database User: $DB_USER
Database Password: $DB_PASS
Bot Token: $BOT_TOKEN
Admin Chat ID: $ADMIN_CHAT_ID
Installation Date: $(date)
EOF
    chmod 600 /root/WeBot-config/credentials.txt
    
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}✅ WeBot installed successfully!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo -e "${CYAN}Installation Directory:${NC} /opt/WeBot"
    echo -e "${CYAN}Database:${NC} $DB_NAME"
    echo -e "${CYAN}Credentials saved to:${NC} /root/WeBot-config/credentials.txt"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo -e "  ${CYAN}pm2 logs WeBot${NC}     - View logs"
    echo -e "  ${CYAN}pm2 restart WeBot${NC}  - Restart bot"
    echo -e "  ${CYAN}pm2 stop WeBot${NC}     - Stop bot"
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# Update bot
update_bot() {
    clear
    echo -e "${GREEN}=== Updating WeBot ===${NC}\n"
    
    if [ ! -d "/opt/WeBot" ]; then
        echo -e "${RED}Bot is not installed!${NC}"
        sleep 2
        show_menu
        return
    fi
    
    cd /opt/WeBot
    
    # Stop bot
    echo -e "${YELLOW}Stopping bot...${NC}"
    pm2 stop WeBot
    
    # Pull latest changes
    echo -e "${YELLOW}Fetching updates...${NC}"
    git pull origin main || {
        echo -e "${RED}Failed to pull updates${NC}"
        pm2 start WeBot
        sleep 2
        show_menu
        return
    }
    
    # Install dependencies
    echo -e "${YELLOW}Updating dependencies...${NC}"
    npm install
    
    # Run migrations
    echo -e "${YELLOW}Migrating database...${NC}"
    npx prisma generate
    npx prisma migrate deploy
    
    # Build
    echo -e "${YELLOW}Building...${NC}"
    npm run build
    
    # Restart
    echo -e "${YELLOW}Restarting bot...${NC}"
    pm2 restart WeBot
    
    echo -e "${GREEN}✅ Bot updated successfully!${NC}"
    sleep 2
    show_menu
}

# Restart bot  
restart_bot() {
    echo -e "${YELLOW}Restarting bot...${NC}"
    pm2 restart WeBot
    echo -e "${GREEN}✅ Bot restarted${NC}"
    sleep 2
    show_menu
}

# Stop bot
stop_bot() {
    echo -e "${YELLOW}Stopping bot...${NC}"
    pm2 stop WeBot
    echo -e "${GREEN}✅ Bot stopped${NC}"
    sleep 2
    show_menu
}

# View logs
view_logs() {
    clear
    echo -e "${CYAN}=== Bot Logs (Press Ctrl+C to exit) ===${NC}\n"
    pm2 logs WeBot
}

# Backup database
backup_database() {
    echo -e "${YELLOW}Creating database backup...${NC}"
    
    BACKUP_DIR="/root/WeBot-backups"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="$BACKUP_DIR/WeBot_$(date +%Y%m%d_%H%M%S).sql"
    
    # Get database credentials from .env
    cd /opt/WeBot
    DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"')
    DB_NAME=$(echo "$DB_URL" | sed -n 's|.*://.*@.*/\([^?]*\).*|\1|p')
    DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    
    mysqldump -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}❌ Backup failed${NC}"
    fi
    
    sleep 2
    show_menu
}

# Restore database  
restore_database() {
    echo -e "${YELLOW}Available backups:${NC}\n"
    
    BACKUP_DIR="/root/WeBot-backups"
    ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null || {
        echo -e "${RED}No backups found${NC}"
        sleep 2
        show_menu
        return
    }
    
    echo ""
    read -p "Enter backup filename: " BACKUP_FILE
    
    if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        echo -e "${RED}Backup file not found${NC}"
        sleep 2
        show_menu
        return
    fi
    
    # Get credentials
    cd /opt/WeBot
    DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2- | tr -d '"')
    DB_NAME=$(echo "$DB_URL" | sed -n 's|.*://.*@.*/\([^?]*\).*|\1|p')
    DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    
    echo -e "${YELLOW}Restoring database...${NC}"
    mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$BACKUP_DIR/$BACKUP_FILE"
    
    echo -e "${GREEN}✅ Database restored${NC}"
    sleep 2
    show_menu
}

# Uninstall bot
uninstall_bot() {
    clear
    echo -e "${RED}=== UNINSTALL WeBot ===${NC}\n"
    echo -e "${YELLOW}WARNING: This will remove all bot files and data!${NC}"
    read -p "Are you sure? Type 'yes' to confirm: " confirm
    
    if [ "$confirm" != "yes" ]; then
        show_menu
        return
    fi
    
    # Stop and remove from PM2
    pm2 delete WeBot 2>/dev/null
    pm2 save
    
    # Remove installation directory
    rm -rf /opt/WeBot
    
    # Optionally remove database
    read -p "Remove database? (y/n): " remove_db
    if [[ "$remove_db" == "y" || "$remove_db" == "Y" ]]; then
        echo "DROP DATABASE IF EXISTS WeBot;" | mysql
        echo -e "${GREEN}✅ Database removed${NC}"
    fi
    
    echo -e "${GREEN}✅ Bot uninstalled${NC}"
    sleep 2
    exit 0
}

# ==============================================================================
# MAIN
# ==============================================================================

# Make script executable as 'WeBot' command
chmod +x "$0"
ln -sf "$0" /usr/local/bin/WeBot 2>/dev/null

# Show menu
show_menu

