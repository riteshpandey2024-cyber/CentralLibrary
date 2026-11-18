import React, { useState } from 'react';

export default function ContactForm() {
  const [result, setResult] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setResult('Sending....');

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append('access_key', '569d8f27-4def-4d7c-99ab-bfdbe21c0540');

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setResult('Form Submitted Successfully');
        form.reset();
      } else {
        setResult(data.message || 'Error');
      }
    } catch {
      setResult('Error submitting form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2DFD5] rounded-xl p-6 sm:p-8">
      <h3 className="font-serif text-2xl font-bold text-[#101D35]">
        Send an Enquiry
      </h3>
      <p className="mt-1.5 text-sm text-[#586272]">
        Have questions about membership plans, seat availability, or visiting hours?
        Write to our administration desk.
      </p>

      {result && (
        <div
          className={`mt-4 p-4 rounded-lg text-sm font-medium ${
            result === 'Form Submitted Successfully'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : result === 'Sending....'
              ? 'bg-blue-50 border border-blue-200 text-blue-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          {result}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="contact-name"
              className="block text-sm font-medium text-[#101D35] mb-1.5"
            >
              Full Name *
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              placeholder="Your full name"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
            />
          </div>
          <div>
            <label
              htmlFor="contact-mobile"
              className="block text-sm font-medium text-[#101D35] mb-1.5"
            >
              Mobile Number
            </label>
            <input
              id="contact-mobile"
              name="mobile"
              type="tel"
              placeholder="10-digit mobile number"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="contact-email"
              className="block text-sm font-medium text-[#101D35] mb-1.5"
            >
              Email Address *
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
            />
          </div>
          <div>
            <label
              htmlFor="contact-subject"
              className="block text-sm font-medium text-[#101D35] mb-1.5"
            >
              Enquiry Topic
            </label>
            <select
              id="contact-subject"
              name="subject"
              defaultValue="Membership Enquiry"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
            >
              <option value="Membership Enquiry">Membership Enquiry</option>
              <option value="Schedule a Library Visit">Schedule a Library Visit</option>
              <option value="Seat Availability">Seat Availability</option>
              <option value="General Question">General Question</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="contact-message"
            className="block text-sm font-medium text-[#101D35] mb-1.5"
          >
            Message *
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={4}
            required
            placeholder="Share your study schedule, membership query, or preferred visiting time..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-[#D6D2C7] bg-[#FDFCF9] text-sm text-[#101D35] focus:outline-none focus:border-[#101D35]"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#101D35] text-[#F8F6F0] text-sm font-semibold hover:bg-[#172943] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Sending....' : 'Submit Enquiry'}
          </button>
          {result && (
            <span
              className={`text-sm ${
                result === 'Form Submitted Successfully'
                  ? 'text-emerald-700'
                  : result === 'Sending....'
                  ? 'text-blue-700'
                  : 'text-red-600'
              }`}
            >
              {result}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
