import Foundation

enum KernAPIError: LocalizedError {
    case invalidConfiguration
    case invalidResponse
    case server(String, Int)
    case offline

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration: "The Kern service URL is invalid."
        case .invalidResponse: "The reef returned an unreadable response."
        case let .server(message, _): message
        case .offline: "Kern cannot reach the reef right now. Your care action is saved on this iPhone."
        }
    }
}

actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private var token: String?
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        encoder = JSONEncoder()
        decoder = JSONDecoder()
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    func register(username: String, password: String, initialState: PetState) async throws -> AuthResponse {
        struct Body: Encodable { let username: String; let password: String; let initialState: PetState }
        return try await send(
            "/api/auth/register",
            method: "POST",
            body: Body(username: username, password: password, initialState: initialState),
            authenticated: false
        )
    }

    func login(username: String, password: String) async throws -> AuthResponse {
        struct Body: Encodable { let username: String; let password: String }
        return try await send(
            "/api/auth/login",
            method: "POST",
            body: Body(username: username, password: password),
            authenticated: false
        )
    }

    func pet() async throws -> PetResponse {
        try await request("/api/pet", authenticated: true)
    }

    func apply(_ action: PendingAction) async throws -> ActionResponse {
        struct Body: Encodable {
            let actionId: String
            let type: PendingAction.Kind
            let occurredAt: String
            let name: String?
        }
        return try await send(
            "/api/pet/actions",
            method: "POST",
            body: Body(
                actionId: action.id,
                type: action.type,
                occurredAt: action.occurredAt,
                name: action.name
            ),
            authenticated: true
        )
    }

    func notificationState() async throws -> NotificationStateResponse {
        try await request("/api/notifications", authenticated: true)
    }

    func registerNativeDevice(
        token: String,
        environment: String,
        fullnessThreshold: Int = 35,
        cooldownHours: Int = 12
    ) async throws -> NotificationStateResponse {
        struct Device: Encodable { let token: String; let environment: String }
        struct Preferences: Encodable { let fullnessThreshold: Int; let cooldownHours: Int }
        struct Body: Encodable { let device: Device; let preferences: Preferences }
        return try await send(
            "/api/notifications/native-devices",
            method: "POST",
            body: Body(
                device: Device(token: token, environment: environment),
                preferences: Preferences(
                    fullnessThreshold: fullnessThreshold,
                    cooldownHours: cooldownHours
                )
            ),
            authenticated: true
        )
    }

    func removeNativeDevice(token: String) async throws -> NotificationStateResponse {
        struct Body: Encodable { let token: String }
        return try await send(
            "/api/notifications/native-devices",
            method: "DELETE",
            body: Body(token: token),
            authenticated: true
        )
    }

    func sendTestNotification() async throws -> NotificationStateResponse {
        struct EmptyBody: Encodable {}
        return try await send(
            "/api/notifications/test",
            method: "POST",
            body: EmptyBody(),
            authenticated: true
        )
    }

    private func send<Response: Decodable, Body: Encodable>(
        _ path: String,
        method: String,
        body: Body,
        authenticated: Bool
    ) async throws -> Response {
        try await request(
            path,
            method: method,
            body: try encoder.encode(body),
            authenticated: authenticated
        )
    }

    private func request<Response: Decodable>(
        _ path: String,
        method: String = "GET",
        body: Data? = nil,
        authenticated: Bool
    ) async throws -> Response {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw KernAPIError.invalidConfiguration
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if authenticated, let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw KernAPIError.offline
        }
        guard let http = response as? HTTPURLResponse else { throw KernAPIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            struct ErrorBody: Decodable { let error: String }
            let message = (try? decoder.decode(ErrorBody.self, from: data).error) ?? "The reef could not complete that request."
            throw KernAPIError.server(message, http.statusCode)
        }
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw KernAPIError.invalidResponse
        }
    }
}

enum AppConfiguration {
    static var apiBaseURL: URL {
        let configured = Bundle.main.object(forInfoDictionaryKey: "KernAPIBaseURL") as? String
        return URL(string: configured ?? "") ?? URL(string: "https://kern-reef-companion.onrender.com")!
    }

    static var apnsEnvironment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }
}
