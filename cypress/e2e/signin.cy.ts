describe("Local sign-in payload", () => {
  it("omits setup-only fields when an existing user requests a code", () => {
    cy.intercept("GET", "/api/me*", { authenticated: false });
    cy.intercept("POST", "/api/auth/send-otp", (request) => {
      expect(request.body.email).to.equal("review@example.com");
      expect(request.body.purpose).to.equal("signin");
      expect(request.body).not.to.have.property("name");
      expect(request.body).not.to.have.property("workspaceName");
      request.reply({ success: true, devVerificationCode: "123456" });
    }).as("sendCode");
    cy.visit("/", { onBeforeLoad(win) { win.localStorage.clear(); } });
    cy.contains("button", "Sign In").click();
    cy.get('input[type="email"]').type("review@example.com");
    cy.contains("button", "Send Login Code").click();
    cy.wait("@sendCode");
    cy.contains("Invalid request payload").should("not.exist");
  });
});
