document.addEventListener("DOMContentLoaded", () => {
 const body = document.body;
 // Language toggle
 const langButtons = document.querySelectorAll("[data-lang], .lang-toggle, #langToggle");
 langButtons.forEach((btn) => {
   btn.addEventListener("click", () => {
     const currentLang = body.getAttribute("data-lang") || "en";
     const nextLang = currentLang === "en" ? "ar" : "en";
     body.setAttribute("data-lang", nextLang);
     document.documentElement.lang = nextLang;
     document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
     document.querySelectorAll(".en").forEach((el) => {
       el.style.display = nextLang === "en" ? "" : "none";
     });
     document.querySelectorAll(".ar").forEach((el) => {
       el.style.display = nextLang === "ar" ? "" : "none";
     });
     btn.textContent = nextLang === "en" ? "AR" : "EN";
   });
 });
 // Default language setup
 body.setAttribute("data-lang", "en");
 document.querySelectorAll(".ar").forEach((el) => {
   el.style.display = "none";
 });
 // Create modal
 const modal = document.createElement("div");
 modal.className = "qovalx-modal";
 modal.innerHTML = `
<div class="qovalx-modal-backdrop"></div>
<div class="qovalx-modal-card">
<button class="qovalx-modal-close" aria-label="Close">×</button>
<div class="qovalx-modal-icon">Q</div>
<h2>Private Access Coming Soon</h2>
<p>
       QOVALX is preparing a private launch for selected brokers,
       developers, investors and strategic partners.
</p>
<p class="modal-small">
       Join the early access list to be notified when access opens.
</p>
<form class="qovalx-access-form">
<input type="email" placeholder="Enter your email" required />
<select required>
<option value="">I am interested as...</option>
<option>Broker</option>
<option>Developer</option>
<option>Investor</option>
<option>Strategic Partner</option>
</select>
<button type="submit">Request Early Access</button>
</form>
<div class="qovalx-form-message"></div>
</div>
 `;
 document.body.appendChild(modal);
 const openModal = () => {
   modal.classList.add("active");
 };
 const closeModal = () => {
   modal.classList.remove("active");
 };
 modal.querySelector(".qovalx-modal-close").addEventListener("click", closeModal);
 modal.querySelector(".qovalx-modal-backdrop").addEventListener("click", closeModal);
 // Open modal from buttons
 document.querySelectorAll("a, button").forEach((el) => {
   const text = (el.textContent || "").toLowerCase();
   const href = (el.getAttribute("href") || "").toLowerCase();
   if (
     text.includes("login") ||
     text.includes("early access") ||
     text.includes("request access") ||
     text.includes("private access") ||
     href.includes("login") ||
     href.includes("access")
   ) {
     el.addEventListener("click", (e) => {
       e.preventDefault();
       openModal();
     });
   }
 });
 // Form submit
 const form = modal.querySelector(".qovalx-access-form");
 const message = modal.querySelector(".qovalx-form-message");
 form.addEventListener("submit", (e) => {
   e.preventDefault();
   message.textContent =
     "Thank you. Your early access request has been noted. QOVALX will contact selected users before launch.";
   form.reset();
 });
 // Smooth scroll
 document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
   anchor.addEventListener("click", function (e) {
     const target = document.querySelector(this.getAttribute("href"));
     if (target) {
       e.preventDefault();
       target.scrollIntoView({
         behavior: "smooth",
         block: "start",
       });
     }
   });
 });
});
