#!/usr/bin/env python3
"""Unit tests for the pure helpers in mail-watch.py.

Run:  python3 scripts/mail-watch.test.py

Python (not node:test) for the same reason the script itself is Python — imaplib
is stdlib and Node has no IMAP client. Loaded via importlib because the module
name contains a dash; importing only defines functions (main is __main__-gated).
"""
import importlib.util
import os
import unittest
from email.message import EmailMessage

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("mail_watch", os.path.join(HERE, "mail-watch.py"))
mw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mw)


class FindFits(unittest.TestCase):
    def test_matches_our_geography(self):
        text = "From: BBC\nLooking for residents in Panama, Mexico, UAE, Thailand, and Brazil\nWhat keeps you living here?"
        hits = mw.find_fits(text)
        self.assertEqual(len(hits), 1)
        self.assertIn("UAE", hits[0]["quote"])

    def test_matches_dubai_and_golden_visa(self):
        self.assertTrue(mw.find_fits("Seeking an agent who sells property in Dubai Marina"))
        self.assertTrue(mw.find_fits("Experts on the UAE golden visa for investors"))
        self.assertTrue(mw.find_fits("Sources living as expats in the Gulf"))

    def test_bound_phrases_match(self):
        self.assertTrue(mw.find_fits("Looking for international property buyers to comment"))
        self.assertTrue(mw.find_fits("Anyone buying a home abroad this year?"))
        self.assertTrue(mw.find_fits("Foreign investors in residential real estate"))

    def test_us_market_queries_do_not_match(self):
        """These are verbatim from the 27-29 July digests — all must stay silent."""
        for line in [
            "Realtor.com: Real estate agents to discuss closing on FHA loans",
            "Seeking Springfield, Ohio landlords/property managers",
            "Safety is often one of the biggest factors for homebuyers in the Atlanta metro area",
            "What is your top hack for flying internationally with bulky hiking gear?",
            "decision criteria around job, long-distance, or military relocation",
            "Some corporate relocation management firms purchase homes from workers who are moving",
            "MarketWatch: Financial planners on minimizing taxes in retirement",
        ]:
            self.assertEqual(mw.find_fits(line), [], f"false positive on: {line}")

    def test_deadline_picked_from_nearby_lines(self):
        text = "From: BBC\nSubmit By: 29 July 4:14PM MSK (in 2 days)\nLooking for residents in the UAE"
        hits = mw.find_fits(text)
        self.assertEqual(hits[0]["deadline"], "Submit By: 29 July 4:14PM MSK (in 2 days)")

    def test_nearest_deadline_wins_in_a_multi_request_digest(self):
        """A Qwoted round-up: the other request's deadline must not be attached."""
        text = "\n".join([
            "Submit By: 28 July 4:22PM MSK",
            "Travel experts needed on airline results",
            "filler", "filler", "filler",
            "Submit By: 29 July 4:14PM MSK",
            "Looking for residents in the UAE and Thailand",
        ])
        self.assertEqual(mw.find_fits(text)[0]["deadline"], "Submit By: 29 July 4:14PM MSK")

    def test_long_line_quote_contains_the_match(self):
        """600-char paragraph with the match at the end — a head-slice would hide it."""
        line = ("In light of second quarter results I am looking to hear from travel experts "
                + "about themes such as luxury and demand patterns. " * 6
                + "including the Middle East region.")
        quote = mw.find_fits(line)[0]["quote"]
        self.assertIn("Middle East", quote)
        self.assertLessEqual(len(quote), mw.QUOTE_CHARS + 1)

    def test_short_line_quote_contains_the_match(self):
        """Neighbour-borrowing must not push the match past the cut.

        Live case 2026-07-31: the matched line was short, but the line above it
        was a 500-char tracking URL, so slicing the joined block from its start
        produced a quote ending inside the href — the match never appeared.
        """
        text = "\n".join([
            "Congratulations, you have a message " + "x" * 400,
            "saw your thoughts on Dubai",
            "read the rest on Qwoted",
        ])
        quote = mw.find_fits(text)[0]["quote"]
        self.assertIn("Dubai", quote)
        self.assertLessEqual(len(quote), mw.QUOTE_CHARS + 1)

    def test_no_deadline_is_none_not_crash(self):
        self.assertIsNone(mw.find_fits("Sources in Dubai wanted")[0]["deadline"])

    def test_duplicate_quote_reported_once(self):
        """A digest carries the same request in its plain and HTML parts."""
        block = "From: BBC\nLooking for residents in the UAE and Thailand\nWhy did you move?"
        hits = mw.find_fits(block + "\n" + block)
        self.assertEqual(len(hits), 1)

    def test_capped_at_max_fits(self):
        text = "\n".join(f"Request {i}: sources in Dubai wanted for a story" for i in range(10))
        self.assertLessEqual(len(mw.find_fits(text)), mw.MAX_FITS)


class BodyText(unittest.TestCase):
    def test_prefers_plain_over_html(self):
        msg = EmailMessage()
        msg.set_content("plain body about Dubai")
        msg.add_alternative("<p>html body about Dubai</p>", subtype="html")
        self.assertIn("plain body", mw.body_text(msg))

    def test_falls_back_to_stripped_html(self):
        msg = EmailMessage()
        msg.set_content("<p>Sources in <b>Dubai</b> wanted</p>", subtype="html")
        text = mw.body_text(msg)
        self.assertIn("Dubai", text)
        self.assertNotIn("<b>", text)

    def test_script_and_style_dropped(self):
        stripped = mw.strip_html("<style>.a{color:red}</style><script>var x=1</script><p>Dubai</p>")
        self.assertNotIn("color:red", stripped)
        self.assertNotIn("var x", stripped)
        self.assertIn("Dubai", stripped)

    def test_html_entities_decoded(self):
        self.assertIn("Sotheby's", mw.strip_html("<p>Sotheby&#39;s</p>"))

    def test_plain_part_carrying_markup_is_stripped(self):
        """Qwoted's text/plain part embeds real <a href> tags (live mail, 2026-07-31).

        Preferring plain then trusting it blindly put the tracking URL into the
        alert quote instead of the request, so the ФИТ read as noise.
        """
        msg = EmailMessage()
        msg.set_content('You got a message, <a href="http://url1940.qwoted.com/ls/click?upn=u001.Ta">'
                        "read it</a> about Dubai")
        text = mw.body_text(msg)
        self.assertNotIn("<a href", text)
        self.assertNotIn("url1940", text)
        self.assertIn("Dubai", text)

    def test_clean_plain_text_is_left_alone(self):
        """A bare '<' in prose must not be eaten by the stripper."""
        msg = EmailMessage()
        msg.set_content("Units < AED 2M in Dubai still yield > 7%")
        self.assertIn("< AED 2M", mw.body_text(msg))


class StripLinks(unittest.TestCase):
    """Addresses must not decide fit — live false alarm, 2026-07-31."""

    def test_senders_own_domain_is_not_a_fit(self):
        """expat.com's transactional mail fired a 🔥 ФИТ on the word in its domain."""
        body = ("Hello,\nYou need to confirm your email address in order to complete your "
                "business registration. To do so, click on the link below:\n"
                "https://et2.expat.com/f/a/Xg0lWbhQntrp6agWuAurgg~~/AAGzbhA~/pAcBp\n"
                "Thank you for registering your business on expat.com")
        self.assertEqual(mw.find_fits(body), [])

    def test_tracking_url_carrying_our_words_is_not_a_fit(self):
        body = "Click https://mail.example.com/ls/click?upn=dubai-uae-golden-visa-report to read"
        self.assertEqual(mw.find_fits(body), [])

    def test_reporter_email_address_is_not_a_fit(self):
        body = "Reach me any time at judy.dutton@dubai-desk.com"
        self.assertEqual(mw.find_fits(body), [])

    def test_prose_beside_a_link_still_matches_without_the_url(self):
        body = ("Saw your very interesting thoughts on Dubai\n"
                "Read the rest at https://app.qwoted.com/inbox/12345")
        fits = mw.find_fits(body)
        self.assertEqual(len(fits), 1)
        self.assertIn("Dubai", fits[0]["quote"])
        self.assertNotIn("qwoted.com", fits[0]["quote"])

    def test_dotted_uae_survives_the_stripper(self):
        """A closed TLD list, so 'U.A.E.' is not mistaken for a domain."""
        self.assertEqual(len(mw.find_fits("Seeking sources based in the U.A.E. for a feature")), 1)


class PitchWatch(unittest.TestCase):
    """Time-boxed watch for replies from the editors we pitched (2026-08-03)."""

    def test_window_closes_by_itself(self):
        self.assertTrue(mw.pitch_watch_active("2026-08-03"))
        self.assertTrue(mw.pitch_watch_active(mw.PITCH_WATCH_UNTIL))
        self.assertFalse(mw.pitch_watch_active("2026-08-18"))

    def test_reply_without_our_vocabulary_still_produces_a_quote(self):
        """"Yes, send it over" matches no FIT_PATTERN and must still push."""
        fits = mw.pitch_reply_fits("Hi Dzhambulat,\nYes, please send the full table over.\nBest, Ed")
        self.assertEqual(len(fits), 1)
        self.assertIn("send the full table", fits[0]["quote"])

    def test_quoted_pitch_is_not_mistaken_for_their_answer(self):
        """The reply carries our own letter back; the editor's line must win."""
        body = "> Our Q3 report covers 12 Dubai districts and is free to cite\nHappy to run this, what is the methodology?"
        self.assertIn("methodology", mw.pitch_reply_fits(body)[0]["quote"])

    def test_matching_body_still_uses_the_normal_quotes(self):
        fits = mw.pitch_reply_fits("Can you comment on Dubai rental yields for our piece?")
        self.assertIn("Dubai", fits[0]["quote"])

    def test_empty_body_does_not_silently_drop_the_reply(self):
        self.assertEqual(len(mw.pitch_reply_fits("")), 1)

    def test_failed_body_fetch_still_leaves_a_fit_for_a_pitch_reply(self):
        """No fits = context list = (with no other fit) no Telegram at all."""
        class Broken:
            def uid(self, *a):
                raise OSError("connection reset")
        self.assertEqual(len(mw.fetch_fits(Broken(), 1, pitch=True)), 1)
        self.assertEqual(mw.fetch_fits(Broken(), 1), [])

    def test_empty_fetch_response_still_leaves_a_fit_for_a_pitch_reply(self):
        class Empty:
            def uid(self, *a):
                return "OK", [None]
        self.assertEqual(len(mw.fetch_fits(Empty(), 1, pitch=True)), 1)
        self.assertEqual(mw.fetch_fits(Empty(), 1), [])


class FormatAlert(unittest.TestCase):
    def make(self, subject, fits=None, account="info@worldwise.pro"):
        return {"account": account, "from": "Qwoted <notifications@qwoted.com>",
                "subject": subject, "date": "", "fits": fits or []}

    def test_fit_block_leads_and_carries_quote(self):
        text = mw.format_alert([
            self.make("BBC — new requests", [{"quote": "residents in the UAE", "deadline": "Submit By: 29 July"}]),
            self.make("Realtor.com: FHA loans"),
        ])
        self.assertTrue(text.startswith("🔥 ФИТ: 1"))
        self.assertIn("residents in the UAE", text)
        self.assertIn("⏰ Submit By: 29 July", text)
        self.assertIn("Остальное (1)", text)

    def test_without_fits_keeps_the_old_plain_listing(self):
        text = mw.format_alert([self.make("Realtor.com: FHA loans")])
        self.assertTrue(text.startswith("📬 Вахта: 1"))
        self.assertNotIn("ФИТ", text)

    def test_mailbox_label_shown_per_item(self):
        text = mw.format_alert([self.make("HARO morning", account="dzhambulat@worldwise.pro")])
        self.assertIn("[dzhambulat]", text)

    def test_pitch_reply_is_labelled_and_leads_the_fits(self):
        """An unfamiliar editor domain must not read like just another digest."""
        digest = self.make("BBC — new requests", [{"quote": "residents in the UAE", "deadline": None}])
        reply = self.make("Re: Dubai yields by district", [{"quote": "what is the methodology?", "deadline": None}])
        reply["pitch"] = True
        reply["from"] = "Somshankar Bandyopadhyay <somshankar@khaleejtimes.com>"
        text = mw.format_alert([digest, reply])
        self.assertIn("✉️ ОТВЕТ НА ПИТЧ", text)
        self.assertLess(text.index("khaleejtimes.com"), text.index("BBC — new requests"))


class ActivityDigest(unittest.TestCase):
    """expat.com forum-activity mail must never reach the fit tier.

    Its body is full of UAE and visa vocabulary because it quotes forum replies,
    so FIT_RE matches it every time. A fit has to mean "answer this today".
    """

    def test_forum_activity_digest_is_recognised(self):
        self.assertTrue(mw.is_activity_digest(
            "What's up WorldwiseDubai ? Check out the latest forum activities!"))

    def test_personal_platform_mail_still_promotes(self):
        for subject in ("You have a new private message on Expat.com",
                        "Re: your post about the Dubai investor visa",
                        "New reply to a topic you created"):
            self.assertFalse(mw.is_activity_digest(subject), subject)

    def test_media_digests_are_untouched(self):
        for subject in ("HARO Queries for August 5, 2026 - Morning Edition",
                        "Reuters, BBC, CNN - new requests",
                        ""):
            self.assertFalse(mw.is_activity_digest(subject), subject)

    def test_digest_body_would_otherwise_match(self):
        body = ('Dive into the latest on the expat forum! New reply - '
                'Investor visa : how many days stay outside UAE ? on the '
                'United Arab Emirates forum.')
        self.assertTrue(mw.find_fits(body),
                        "guard is pointless unless the body really matches")


class ChunkLines(unittest.TestCase):
    def test_long_fit_alert_is_split_under_the_telegram_limit(self):
        line = "• " + "x" * 300
        chunks = mw.chunk_lines([line] * 40)
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), mw.TG_CHUNK)


if __name__ == "__main__":
    unittest.main(verbosity=2)
