# Good Fixture

A well-structured project for testing RepoProof — a tool for analyzing repository quality.

## Installation

```bash
git clone https://github.com/example/good-fixture.git
cd good-fixture
npm install
```

## Usage

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Environment Variables

| Variable       | Description                  | Default                                   |
|----------------|------------------------------|-------------------------------------------|
| `PORT`         | Server port                  | `3000`                                    |
| `NODE_ENV`     | Environment mode             | `development`                             |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost:5432/myapp`       |

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

## License

MIT
