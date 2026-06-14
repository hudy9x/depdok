fn main() {
    if let Err(error) = odoflow_agent_lib::mcp_server::run() {
        eprintln!("depdok-mcp-server: {error}");
        std::process::exit(1);
    }
}