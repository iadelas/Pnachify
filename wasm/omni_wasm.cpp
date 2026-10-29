#include "analysis/raw_plausibility.hpp"
#include "core/code_format.hpp"
#include "core/crypt.hpp"
#include "convert/conversion_service.hpp"
#include "util/hex.hpp"

#include <array>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace {

std::string last_error;
std::string last_format;

std::string_view text_or_empty(const char* value) {
    return value == nullptr ? std::string_view{} : std::string_view{value};
}

omni::CodeFormat format_for(omni::Crypt crypt) {
    switch (crypt) {
        case omni::Crypt::ar1: return omni::CodeFormat::action_replay1;
        case omni::Crypt::ar2: return omni::CodeFormat::action_replay2;
        case omni::Crypt::armax: return omni::CodeFormat::action_replay_max;
        case omni::Crypt::codebreaker: return omni::CodeFormat::codebreaker1_6;
        case omni::Crypt::codebreaker7_common: return omni::CodeFormat::codebreaker7_common;
        case omni::Crypt::gameshark3: return omni::CodeFormat::gameshark_madcatz34;
        case omni::Crypt::gameshark5: return omni::CodeFormat::gameshark_madcatz5;
        case omni::Crypt::max_raw: return omni::CodeFormat::armax_raw;
        case omni::Crypt::raw: return omni::CodeFormat::standard_raw;
        case omni::Crypt::ar2_raw: return omni::CodeFormat::ar12_raw;
        case omni::Crypt::codebreaker_raw: return omni::CodeFormat::codebreaker_raw;
        case omni::Crypt::gameshark_raw: return omni::CodeFormat::gameshark3_raw;
    }
    return omni::CodeFormat::standard_raw;
}

struct Candidate {
    omni::CodeFormat format;
    std::size_t valid;
    std::size_t total;
};

bool is_master_word(std::uint32_t word) noexcept {
    const std::uint32_t type = word >> 28U;
    if (type == 0x9U || type == 0xFU) return true;
    const std::uint32_t addr = word & 0x0FFFFFFFU;
    return addr == 0x000FFFFEU || addr == 0x000FFFFFU;
}

bool is_master_block(const omni::formats::text::CheatBlock& block) noexcept {
    if (block.cheat.word_count() < 2U) return false;
    for (std::size_t index = 0; index < block.cheat.word_count(); index += 2U) {
        if (!is_master_word(block.cheat.words[index])) return false;
    }
    return true;
}

std::optional<Candidate> try_candidate(std::string_view text, omni::CodeFormat input,
                                       omni::CodeFormat output) {
    try {
        omni::convert::Request request{input, output};
        request.transpose_mode = omni::translate::TransposeMode::original;
        request.continue_on_error = true;
        const omni::convert::Result result = omni::convert::convert_text(text, request);

        std::size_t valid = 0;
        std::size_t scored = 0;
        for (const omni::formats::text::CheatBlock& block : result.blocks) {
            if (block.conversion_error || block.cheat.word_count() == 0U ||
                is_master_block(block)) {
                continue;
            }
            ++scored;
            if (omni::analysis::validate_raw_plausibility(block.cheat).valid) ++valid;
        }
        if (scored == 0U) return std::nullopt;
        return Candidate{input, valid, scored};
    } catch (...) {
        return std::nullopt;
    }
}

constexpr std::array<omni::Crypt, 7> encrypted_candidates{{
    omni::Crypt::gameshark3, omni::Crypt::ar1, omni::Crypt::ar2, omni::Crypt::armax,
    omni::Crypt::codebreaker, omni::Crypt::codebreaker7_common, omni::Crypt::gameshark5
}};

std::optional<std::string_view> first_crypt_tag(std::string_view text) {
    const auto at = text.find("CRYPT_");
    if (at == std::string_view::npos) return std::nullopt;
    std::size_t end = at + 6U;
    while (end < text.size()) {
        const char character = text[end];
        const bool allowed = (character >= 'A' && character <= 'Z') ||
                             (character >= '0' && character <= '9') || character == '_';
        if (!allowed) break;
        ++end;
    }
    if (end == at + 6U) return std::nullopt;
    return text.substr(at + 6U, end - at - 6U);
}

bool is_complete(const Candidate& candidate) noexcept {
    return candidate.valid > 0U && candidate.valid == candidate.total;
}

omni::CodeFormat raw_format_for(omni::Crypt crypt) {
    switch (crypt) {
        case omni::Crypt::armax: return omni::CodeFormat::armax_raw;
        case omni::Crypt::ar1:
        case omni::Crypt::ar2: return omni::CodeFormat::ar12_raw;
        case omni::Crypt::codebreaker:
        case omni::Crypt::codebreaker7_common: return omni::CodeFormat::codebreaker_raw;
        case omni::Crypt::gameshark3:
        case omni::Crypt::gameshark5: return omni::CodeFormat::gameshark3_raw;
        case omni::Crypt::max_raw: return omni::CodeFormat::armax_raw;
        case omni::Crypt::raw: return omni::CodeFormat::standard_raw;
        case omni::Crypt::ar2_raw: return omni::CodeFormat::ar12_raw;
        case omni::Crypt::codebreaker_raw: return omni::CodeFormat::codebreaker_raw;
        case omni::Crypt::gameshark_raw: return omni::CodeFormat::gameshark3_raw;
    }
    return omni::CodeFormat::standard_raw;
}

std::optional<omni::CodeFormat> detect_format(std::string_view text,
                                              omni::CodeFormat output) {
    if (const auto tag = first_crypt_tag(text)) {
        if (const auto crypt = omni::parse_crypt(*tag)) {
            const omni::CodeFormat format = format_for(*crypt);
            const auto tagged = try_candidate(text, omni::CodeFormat::inline_headers, output);
            if (tagged && is_complete(*tagged)) {
                last_format = std::string(omni::code_format_token(format));
                return omni::CodeFormat::inline_headers;
            }

            const omni::CodeFormat raw_format = raw_format_for(*crypt);
            const auto untagged = try_candidate(text, raw_format, output);
            if (untagged && is_complete(*untagged)) {
                last_format = std::string(omni::code_format_token(raw_format));
                return raw_format;
            }

            last_format = "RAW";
            return omni::CodeFormat::standard_raw;
        }
    }

    const auto raw = try_candidate(text, omni::CodeFormat::standard_raw, output);
    if (raw && is_complete(*raw)) {
        last_format = "RAW";
        return omni::CodeFormat::standard_raw;
    }

    for (omni::Crypt candidate : encrypted_candidates) {
        const auto attempt = try_candidate(text, format_for(candidate), output);
        if (!attempt || !is_complete(*attempt)) continue;
        last_format = std::string(omni::code_format_token(attempt->format));
        return attempt->format;
    }

    last_format = "RAW";
    return omni::CodeFormat::standard_raw;
}

char* convert_impl(std::string_view input_text, omni::CodeFormat input,
                   omni::CodeFormat output, std::string_view game_name,
                   std::string_view crc_hex, bool continue_on_error) {
    omni::convert::Request request{input, output};
    request.continue_on_error = continue_on_error;
    request.game_name = std::string(game_name);

    if (!crc_hex.empty()) {
        const auto crc = omni::hex::parse_u32(crc_hex);
        if (!crc) {
            last_error = "invalid CRC: " + std::string(crc_hex);
            return nullptr;
        }
        request.pnach_include_crc = true;
        request.pnach_crc = *crc;
    }

    const omni::convert::Result result = omni::convert::convert_text(input_text, request);

    char* copy = static_cast<char*>(std::malloc(result.output_text.size() + 1U));
    if (copy == nullptr) {
        last_error = "out of memory";
        return nullptr;
    }
    std::memcpy(copy, result.output_text.c_str(), result.output_text.size() + 1U);
    last_error.clear();
    return copy;
}

} // namespace

extern "C" {

const char* omni_last_error() {
    return last_error.c_str();
}

const char* omni_last_format() {
    return last_format.c_str();
}

void omni_free(char* value) {
    std::free(value);
}

char* omni_convert(const char* input_text,
                   const char* input_format,
                   const char* output_format,
                   const char* game_name,
                   const char* crc_hex,
                   int continue_on_error) {
    try {
        const auto input = omni::parse_code_format(text_or_empty(input_format));
        if (!input) {
            last_error = "unknown input format: " + std::string(text_or_empty(input_format));
            return nullptr;
        }
        const auto output = omni::parse_code_format(text_or_empty(output_format));
        if (!output) {
            last_error = "unknown output format: " + std::string(text_or_empty(output_format));
            return nullptr;
        }
        last_format = std::string(text_or_empty(input_format));
        return convert_impl(text_or_empty(input_text), *input, *output,
                            text_or_empty(game_name), text_or_empty(crc_hex),
                            continue_on_error != 0);
    } catch (const std::exception& error) {
        last_error = error.what();
        return nullptr;
    } catch (...) {
        last_error = "unknown error";
        return nullptr;
    }
}

char* omni_convert_auto(const char* input_text,
                        const char* output_format,
                        const char* game_name,
                        const char* crc_hex,
                        int continue_on_error) {
    try {
        const auto output = omni::parse_code_format(text_or_empty(output_format));
        if (!output) {
            last_error = "unknown output format: " + std::string(text_or_empty(output_format));
            return nullptr;
        }
        const auto detected = detect_format(text_or_empty(input_text), *output);
        return convert_impl(text_or_empty(input_text), *detected, *output,
                            text_or_empty(game_name), text_or_empty(crc_hex),
                            continue_on_error != 0);
    } catch (const std::exception& error) {
        last_error = error.what();
        return nullptr;
    } catch (...) {
        last_error = "unknown error";
        return nullptr;
    }
}

} // extern "C"
