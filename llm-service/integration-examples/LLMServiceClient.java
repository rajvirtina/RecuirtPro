"""
Spring Boot Integration Example for RecruitPro
Java client for LLM microservice communication
"""

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Slf4j
@Service
public class LLMServiceClient {

    @Value("${llm.service.url:http://localhost:8001}")
    private String llmServiceUrl;

    @Value("${llm.service.api-key:default-secret-key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public LLMServiceClient() {
        this.restTemplate = new RestTemplate();
    }

    // ========== Request/Response DTOs ==========

    @Data
    public static class ScheduleRequest {
        private List<String> hrAvailability;
        private List<String> candidateAvailability;
        private String interviewType;
        private Integer durationMinutes;
    }

    @Data
    public static class ScheduleResponse {
        private boolean success;
        private String selectedSlot;
        private String emailSubject;
        private String emailBody;
        private String error;
    }

    @Data
    public static class FeedbackRequest {
        private String role;
        private String interviewType;
        private String rawFeedback;
    }

    @Data
    public static class FeedbackResponse {
        private boolean success;
        private Integer technicalSkills;
        private Integer communication;
        private Integer problemSolving;
        private List<String> strengths;
        private List<String> weaknesses;
        private String finalRecommendation;
        private String confidenceLevel;
        private String error;
    }

    @Data
    public static class CandidateMessageRequest {
        private String evaluationSummary;
        private String outcome;
        private String candidateName;
    }

    @Data
    public static class MessageResponse {
        private boolean success;
        private String candidateMessage;
        private String error;
    }

    // ========== Service Methods ==========

    public ScheduleResponse scheduleInterview(ScheduleRequest request) {
        try {
            String url = llmServiceUrl + "/api/schedule-interview";
            HttpHeaders headers = createHeaders();
            HttpEntity<ScheduleRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<ScheduleResponse> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                ScheduleResponse.class
            );

            log.info("LLM Service: Interview scheduled successfully");
            return response.getBody();

        } catch (HttpClientErrorException e) {
            log.error("LLM Service Error: {}", e.getMessage());
            ScheduleResponse errorResponse = new ScheduleResponse();
            errorResponse.setSuccess(false);
            errorResponse.setError(e.getMessage());
            return errorResponse;
        }
    }

    public FeedbackResponse analyzeFeedback(FeedbackRequest request) {
        try {
            String url = llmServiceUrl + "/api/analyze-feedback";
            HttpHeaders headers = createHeaders();
            HttpEntity<FeedbackRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<FeedbackResponse> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                FeedbackResponse.class
            );

            log.info("LLM Service: Feedback analyzed successfully");
            return response.getBody();

        } catch (HttpClientErrorException e) {
            log.error("LLM Service Error: {}", e.getMessage());
            FeedbackResponse errorResponse = new FeedbackResponse();
            errorResponse.setSuccess(false);
            errorResponse.setError(e.getMessage());
            return errorResponse;
        }
    }

    public MessageResponse generateCandidateMessage(CandidateMessageRequest request) {
        try {
            String url = llmServiceUrl + "/api/candidate-message";
            HttpHeaders headers = createHeaders();
            HttpEntity<CandidateMessageRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<MessageResponse> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                MessageResponse.class
            );

            log.info("LLM Service: Candidate message generated successfully");
            return response.getBody();

        } catch (HttpClientErrorException e) {
            log.error("LLM Service Error: {}", e.getMessage());
            MessageResponse errorResponse = new MessageResponse();
            errorResponse.setSuccess(false);
            errorResponse.setError(e.getMessage());
            return errorResponse;
        }
    }

    public boolean healthCheck() {
        try {
            String url = llmServiceUrl + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            log.error("LLM Service health check failed: {}", e.getMessage());
            return false;
        }
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-API-Key", apiKey);
        return headers;
    }
}

// ========== Example Controller Usage ==========

@RestController
@RequestMapping("/api/interviews")
public class InterviewController {

    private final LLMServiceClient llmService;

    public InterviewController(LLMServiceClient llmService) {
        this.llmService = llmService;
    }

    @PostMapping("/schedule")
    public ResponseEntity<?> scheduleInterview(@RequestBody ScheduleRequest request) {
        LLMServiceClient.ScheduleResponse response = llmService.scheduleInterview(request);

        if (response.isSuccess()) {
            // Save to database, send email, etc.
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(response);
        }
    }

    @PostMapping("/analyze-feedback")
    public ResponseEntity<?> analyzeFeedback(@RequestBody FeedbackRequest request) {
        LLMServiceClient.FeedbackResponse response = llmService.analyzeFeedback(request);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(response);
        }
    }
}
