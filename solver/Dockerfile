FROM rust:1-bookworm AS build
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked --bin solver

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 app
COPY --from=build /app/target/release/solver /usr/local/bin/solver
USER app
ENV LISTEN_ADDR=0.0.0.0:8080
EXPOSE 8080
CMD ["solver"]
