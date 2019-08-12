#!/bin/sh 
cd $(dirname "$0")
# generation stolen from: https://gist.github.com/earthgecko/3089509
SESSNAME=$(basename "$PWD")"-"$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 5 | head -n 1)
tmux new-session -s $SESSNAME -d
tmux send-keys "clear; npm run watch" Enter
tmux split-window -h
tmux send-keys "clear; firebase serve --host 0.0.0.0 --port 5005" Enter
tmux -2 attach-session -d 