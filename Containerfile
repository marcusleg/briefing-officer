FROM rust:1.75-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/rust-monolith-port /app/rust-monolith-port
CMD ["/app/rust-monolith-port"]
