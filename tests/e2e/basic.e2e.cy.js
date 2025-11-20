describe("AI Interview Assistant – E2E", () => {
  it("loads home page", () => {
    cy.visit("http://localhost:3000");
    cy.contains("Interview");
  });
});
