<h1 align="center">thicctactoe</h1>

<p align="center">tictactoe that requires more brain (i think)</p>

<p align="center"><a href="https://thicctactoe.com"><b>play it at thicctactoe.com</b></a></p>

![thumbnail](https://user-images.githubusercontent.com/61931072/225155039-2f6da681-f7ca-4d5c-8074-7738c5b102e2.png)

## how it works

it's tic-tac-toe, but each player gets 5 small, 3 medium and 1 large piece. a bigger piece can cover any smaller piece, including your opponent's, so a square is never really safe. first to three in a row wins.

inspired by gobblet gobblers.

## features

- online play: find a random match, or send a friend an invite link
- guest play: no account needed, just open the site and play
- rated games and an elo leaderboard (sign in with google or github)
- player profiles, game history and replays
- local mode for two people on one device
- an interactive tutorial
- works on phones

## running locally

you'll need [bun](https://bun.sh) and docker.

```
git clone git@github.com:narasaka/thicctactoe.git
cd thicctactoe
bun install
docker compose up -d   # postgres + an s3-compatible bucket
```

the committed `.env` files are encrypted with [dotenvx](https://dotenvx.com). if you don't have the keys, replace them with plain values:

```
# apps/server/.env
BETTER_AUTH_SECRET=any-random-string-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
DATABASE_URL=postgres://postgres:password@localhost:5432/thicctactoe
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=thicctactoe
S3_ACCESS_KEY_ID=rustfsadmin
S3_SECRET_ACCESS_KEY=rustfsadmin

# apps/web/.env
VITE_SERVER_URL=http://localhost:3000
```

then:

```
bun run db:migrate
bun run dev
```

the site runs on http://localhost:3001 and the api on http://localhost:3000. google and github sign-in are off unless you add their client ids and secrets; guest play works without them.

## stack

bun, hono, orpc, better-auth, drizzle + postgres on the server; tanstack start, react and tailwind on the web. the game rules live in `packages/game` and run on both sides.
