#!/bin/bash
V=$(date +%s | tail -c 5)
sed -i "s/?v=[0-9]*\"/?v=$V\"/g" /home/viivadmin/viiv/frontend/pwa/index.html
sed -i "s/?v=[0-9]*\"/?v=$V\"/g" /home/viivadmin/viiv/modulechat/ui/dashboard/index.html
echo "✅ bumped all ?v= to $V"
